import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { z } from "zod";

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const loftParamsSchema = z.object({
  floorAreaM2: z.number().positive().max(500),
  complexity: z.enum(["simple", "standard", "complex"]),
  includeEnSuite: z.boolean().default(false),
  dormerCount: z.number().int().min(0).max(6).default(0)
});

const newBuildParamsSchema = z.object({
  floorAreaM2: z.number().positive().max(10000),
  storeys: z.number().int().min(1).max(5),
  bedrooms: z.number().int().min(1).max(15),
  specification: z.enum(["basic", "standard", "premium"]),
  includeGarage: z.boolean().default(false)
});

const LOFT_RATE_PER_M2 = {
  simple: 1150,
  standard: 1450,
  complex: 1850
} as const;

const NEW_BUILD_RATE_PER_M2 = {
  basic: 1650,
  standard: 2050,
  premium: 2600
} as const;

export type RegionParameters = {
  region: string;
  loftCostMultiplier: number;
  newBuildCostMultiplier: number;
  taxRate: number;
  buildingCodeRate: number;
  contingencyRate: number;
  managementFeeRate: number;
};

export type RegionParametersRow = {
  region: string;
  loft_cost_multiplier: number | string;
  new_build_cost_multiplier: number | string;
  tax_rate: number | string;
  building_code_rate: number | string;
  contingency_rate: number | string;
  management_fee_rate: number | string;
};

export type LoftCalculationParams = z.infer<typeof loftParamsSchema>;
export type NewBuildCalculationParams = z.infer<typeof newBuildParamsSchema>;

export type CostBreakdownItem = {
  key: string;
  label: string;
  amount: number;
  amountGbp: string;
};

export type DetailedCalculationResult = {
  region: string;
  currency: "GBP";
  generatedAt: string;
  parametersUsed: RegionParameters;
  breakdown: CostBreakdownItem[];
  subtotal: number;
  subtotalGbp: string;
  total: number;
  totalGbp: string;
};

type AdminSupabaseClient = ReturnType<typeof createAdminSupabaseClient>;

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toGbp(value: number): string {
  return gbpFormatter.format(value);
}

function toRequiredNumber(value: number | string, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${field}`);
  }

  return parsed;
}

function mapRegionParametersRow(row: RegionParametersRow): RegionParameters {
  return {
    region: row.region,
    loftCostMultiplier: toRequiredNumber(row.loft_cost_multiplier, "loft_cost_multiplier"),
    newBuildCostMultiplier: toRequiredNumber(row.new_build_cost_multiplier, "new_build_cost_multiplier"),
    taxRate: toRequiredNumber(row.tax_rate, "tax_rate"),
    buildingCodeRate: toRequiredNumber(row.building_code_rate, "building_code_rate"),
    contingencyRate: toRequiredNumber(row.contingency_rate, "contingency_rate"),
    managementFeeRate: toRequiredNumber(row.management_fee_rate, "management_fee_rate")
  };
}

function withGbp(items: Array<Omit<CostBreakdownItem, "amountGbp">>): CostBreakdownItem[] {
  return items.map((item) => ({
    ...item,
    amount: roundMoney(item.amount),
    amountGbp: toGbp(roundMoney(item.amount))
  }));
}

/**
 * Loads region-specific cost, tax, and compliance parameters from Supabase.
 */
export async function loadRegionParameters(
  region: string,
  supabaseClient?: AdminSupabaseClient
): Promise<RegionParameters> {
  const client = supabaseClient ?? createAdminSupabaseClient();
  const { data, error } = await client
    .from("region_parameters")
    .select(
      "region, loft_cost_multiplier, new_build_cost_multiplier, tax_rate, building_code_rate, contingency_rate, management_fee_rate"
    )
    .eq("region", region)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load region parameters: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Region parameters not found for region: ${region}`);
  }

  return mapRegionParametersRow(data as RegionParametersRow);
}

/**
 * Calculates a detailed loft conversion cost breakdown using regional parameters.
 */
export async function calculateLoft(
  rawParams: LoftCalculationParams,
  region: string,
  supabaseClient?: AdminSupabaseClient
): Promise<DetailedCalculationResult> {
  const params = loftParamsSchema.parse(rawParams);
  const regionParameters = await loadRegionParameters(region, supabaseClient);

  const baseBuild =
    params.floorAreaM2 * LOFT_RATE_PER_M2[params.complexity] * regionParameters.loftCostMultiplier;
  const structuralSteel = baseBuild * 0.18;
  const insulationAndFire = params.floorAreaM2 * 95 * regionParameters.loftCostMultiplier;
  const stairPackage = 4200 * regionParameters.loftCostMultiplier;
  const dormers = params.dormerCount * 3800 * regionParameters.loftCostMultiplier;
  const enSuite = params.includeEnSuite ? 8500 * regionParameters.loftCostMultiplier : 0;

  const directItems = withGbp([
    { key: "base_build", label: "Base loft construction", amount: baseBuild },
    { key: "structural_steel", label: "Structural steel & reinforcement", amount: structuralSteel },
    { key: "insulation_fire", label: "Insulation & fire compliance", amount: insulationAndFire },
    { key: "stair_package", label: "Staircase package", amount: stairPackage },
    { key: "dormers", label: "Dormer works", amount: dormers },
    { key: "ensuite", label: "En-suite installation", amount: enSuite }
  ]);

  const directSubtotal = directItems.reduce((sum, item) => sum + item.amount, 0);

  const overheadItems = withGbp([
    {
      key: "building_code_fee",
      label: "Building code and approvals",
      amount: directSubtotal * regionParameters.buildingCodeRate
    },
    {
      key: "tax",
      label: "Regional tax",
      amount: directSubtotal * regionParameters.taxRate
    },
    {
      key: "contingency",
      label: "Contingency",
      amount: directSubtotal * regionParameters.contingencyRate
    }
  ]);

  const subtotal = roundMoney(directSubtotal);
  const total = roundMoney(
    subtotal + overheadItems.reduce((sum, item) => sum + item.amount, 0)
  );

  return {
    region,
    currency: "GBP",
    generatedAt: new Date().toISOString(),
    parametersUsed: regionParameters,
    breakdown: [...directItems, ...overheadItems],
    subtotal,
    subtotalGbp: toGbp(subtotal),
    total,
    totalGbp: toGbp(total)
  };
}

/**
 * Calculates a detailed new-build cost breakdown using regional parameters.
 */
export async function calculateNewBuild(
  rawParams: NewBuildCalculationParams,
  region: string,
  supabaseClient?: AdminSupabaseClient
): Promise<DetailedCalculationResult> {
  const params = newBuildParamsSchema.parse(rawParams);
  const regionParameters = await loadRegionParameters(region, supabaseClient);

  const baseBuild =
    params.floorAreaM2 *
    NEW_BUILD_RATE_PER_M2[params.specification] *
    regionParameters.newBuildCostMultiplier;

  const preliminaries = baseBuild * 0.12;
  const frameAndEnvelope = baseBuild * 0.17;
  const mechanicalElectrical =
    params.floorAreaM2 * 230 * regionParameters.newBuildCostMultiplier;
  const externalWorks =
    params.floorAreaM2 * 140 * regionParameters.newBuildCostMultiplier;
  const sustainability =
    params.bedrooms * 1200 * regionParameters.newBuildCostMultiplier;
  const garage = params.includeGarage ? 18000 * regionParameters.newBuildCostMultiplier : 0;
  const storeyAdjustment = (params.storeys - 1) * 0.05 * baseBuild;

  const directItems = withGbp([
    { key: "base_build", label: "Base new-build construction", amount: baseBuild },
    { key: "preliminaries", label: "Site preliminaries", amount: preliminaries },
    { key: "frame_envelope", label: "Frame and envelope uplift", amount: frameAndEnvelope },
    { key: "mep", label: "Mechanical and electrical services", amount: mechanicalElectrical },
    { key: "external_works", label: "External works", amount: externalWorks },
    { key: "sustainability", label: "Sustainability package", amount: sustainability },
    { key: "garage", label: "Garage", amount: garage },
    { key: "storey_adjustment", label: "Storey complexity adjustment", amount: storeyAdjustment }
  ]);

  const directSubtotal = directItems.reduce((sum, item) => sum + item.amount, 0);

  const overheadItems = withGbp([
    {
      key: "professional_fees",
      label: "Professional fees",
      amount: directSubtotal * regionParameters.managementFeeRate
    },
    {
      key: "building_code_fee",
      label: "Building code and compliance fees",
      amount: directSubtotal * regionParameters.buildingCodeRate
    },
    {
      key: "tax",
      label: "Regional tax",
      amount: directSubtotal * regionParameters.taxRate
    },
    {
      key: "contingency",
      label: "Contingency",
      amount: directSubtotal * regionParameters.contingencyRate
    }
  ]);

  const subtotal = roundMoney(directSubtotal);
  const total = roundMoney(
    subtotal + overheadItems.reduce((sum, item) => sum + item.amount, 0)
  );

  return {
    region,
    currency: "GBP",
    generatedAt: new Date().toISOString(),
    parametersUsed: regionParameters,
    breakdown: [...directItems, ...overheadItems],
    subtotal,
    subtotalGbp: toGbp(subtotal),
    total,
    totalGbp: toGbp(total)
  };
}
