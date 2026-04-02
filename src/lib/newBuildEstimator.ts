import { defaultCostLibrary } from "./costLibrary";
import { postcodeToRegion } from "./enhancedEstimator";
import { getEffectivePrice } from "./pricing/getEffectivePrice";
import {
  isCommercialPropertyType,
  isFlatLikePropertyType,
  PropertyType
} from "./propertyType";
import type { MaterialPriceBand } from "../types/material";
import type {
  NewBuildCategory,
  NewBuildInput,
  NewBuildPropertyType,
  NewBuildResult,
  NewBuildSpec,
  SupplierPriceOverrides
} from "./types";

type Tier = "low" | "typical" | "high";
type TierAmounts = Record<Tier, number>;
type CommercialTypeValue = NonNullable<NewBuildInput["commercialType"]>;

const TIERS: Tier[] = ["low", "typical", "high"];

const baseBuildRates: Record<
  NewBuildPropertyType,
  Record<NewBuildSpec, TierAmounts>
> = {
  [PropertyType.DETACHED_HOUSE]: {
    basic: { low: 1750, typical: 2200, high: 2800 },
    standard: { low: 2200, typical: 2800, high: 3400 },
    premium: { low: 2800, typical: 3500, high: 4500 }
  },
  [PropertyType.SEMI_DETACHED_HOUSE]: {
    basic: { low: 1650, typical: 2100, high: 2650 },
    standard: { low: 2100, typical: 2650, high: 3200 },
    premium: { low: 2650, typical: 3300, high: 4200 }
  },
  [PropertyType.TERRACED_HOUSE]: {
    basic: { low: 1550, typical: 2000, high: 2500 },
    standard: { low: 2000, typical: 2500, high: 3100 },
    premium: { low: 2500, typical: 3200, high: 4000 }
  },
  [PropertyType.END_OFF_TERRACE]: {
    basic: { low: 1600, typical: 2050, high: 2575 },
    standard: { low: 2050, typical: 2575, high: 3150 },
    premium: { low: 2575, typical: 3250, high: 4100 }
  },
  [PropertyType.BUNGALOW]: {
    basic: { low: 1850, typical: 2350, high: 2900 },
    standard: { low: 2350, typical: 2900, high: 3500 },
    premium: { low: 2900, typical: 3600, high: 4600 }
  },
  [PropertyType.COTTAGE]: {
    basic: { low: 1800, typical: 2300, high: 2850 },
    standard: { low: 2300, typical: 2850, high: 3450 },
    premium: { low: 2850, typical: 3550, high: 4550 }
  },
  [PropertyType.FLAT_APARTMENT]: {
    basic: { low: 1600, typical: 2100, high: 2600 },
    standard: { low: 2100, typical: 2600, high: 3200 },
    premium: { low: 2600, typical: 3300, high: 4200 }
  },
  [PropertyType.MAISONETTE]: {
    basic: { low: 1650, typical: 2150, high: 2700 },
    standard: { low: 2150, typical: 2700, high: 3300 },
    premium: { low: 2700, typical: 3400, high: 4300 }
  },
  [PropertyType.TOWNHOUSE]: {
    basic: { low: 1700, typical: 2150, high: 2750 },
    standard: { low: 2150, typical: 2750, high: 3350 },
    premium: { low: 2750, typical: 3450, high: 4400 }
  },
  [PropertyType.OFFICE]: {
    basic: { low: 1200, typical: 1800, high: 2500 },
    standard: { low: 1800, typical: 2500, high: 3200 },
    premium: { low: 2500, typical: 3300, high: 4500 }
  },
  [PropertyType.RETAIL]: {
    basic: { low: 1300, typical: 1900, high: 2600 },
    standard: { low: 1900, typical: 2600, high: 3400 },
    premium: { low: 2600, typical: 3500, high: 4700 }
  },
  [PropertyType.INDUSTRIAL]: {
    basic: { low: 1000, typical: 1450, high: 2100 },
    standard: { low: 1450, typical: 2100, high: 2850 },
    premium: { low: 2100, typical: 2900, high: 3900 }
  },
  [PropertyType.LEISURE]: {
    basic: { low: 1450, typical: 2050, high: 2800 },
    standard: { low: 2050, typical: 2800, high: 3600 },
    premium: { low: 2800, typical: 3700, high: 4900 }
  },
  [PropertyType.HEALTHCARE]: {
    basic: { low: 1600, typical: 2300, high: 3100 },
    standard: { low: 2300, typical: 3100, high: 4000 },
    premium: { low: 3100, typical: 4100, high: 5400 }
  }
};

const newBuildCategoryPercents: Record<NewBuildCategory, number> = {
  substructure: 0.12,
  superstructure: 0.2,
  external_envelope: 0.13,
  windows_and_doors: 0.06,
  internal_finishes: 0.1,
  kitchen: 0.06,
  bathrooms: 0.05,
  electrics: 0.08,
  plumbing_and_heating: 0.07,
  external_works: 0.05,
  preliminaries: 0.08,
  contingency: 0,
  professional_fees: 0
};

const garageCost: TierAmounts = { low: 15000, typical: 25000, high: 40000 };
const renewableCost: TierAmounts = { low: 8000, typical: 15000, high: 25000 };
const basementPerM2: TierAmounts = { low: 1500, typical: 2200, high: 3500 };
const liftCost: TierAmounts = { low: 40000, typical: 65000, high: 100000 };

const fireSafetyCost: TierAmounts = { low: 3000, typical: 5500, high: 9000 };
const enSuiteCostPerRoom: TierAmounts = { low: 4000, typical: 6500, high: 10000 };
const fireEscapeCost: TierAmounts = { low: 8000, typical: 14000, high: 22000 };
const meteringCostPerRoom: TierAmounts = { low: 800, typical: 1200, high: 1800 };
const licensingCost: TierAmounts = { low: 500, typical: 1000, high: 2000 };

const ddaCost: TierAmounts = { low: 5000, typical: 12000, high: 25000 };
const extractionCost: TierAmounts = { low: 8000, typical: 18000, high: 35000 };
const parkingCostPerSpace: TierAmounts = { low: 5000, typical: 10000, high: 20000 };

const fitOutRates: Record<"shell_only" | "cat_a" | "cat_b", TierAmounts> = {
  shell_only: { low: 0, typical: 0, high: 0 },
  cat_a: { low: 300, typical: 500, high: 800 },
  cat_b: { low: 500, typical: 900, high: 1500 }
};

const categoryOrder: NewBuildCategory[] = [
  "substructure",
  "superstructure",
  "external_envelope",
  "windows_and_doors",
  "internal_finishes",
  "kitchen",
  "bathrooms",
  "electrics",
  "plumbing_and_heating",
  "external_works",
  "preliminaries",
  "contingency",
  "professional_fees"
];

const SPEC_TO_PRICE_BAND: Record<NewBuildSpec, MaterialPriceBand> = {
  basic: "low",
  standard: "mid",
  premium: "high"
};

function multiplyTier(amounts: TierAmounts, multiplier: number): TierAmounts {
  return {
    low: amounts.low * multiplier,
    typical: amounts.typical * multiplier,
    high: amounts.high * multiplier
  };
}

function addTier(target: TierAmounts, addition: TierAmounts): TierAmounts {
  return {
    low: target.low + addition.low,
    typical: target.typical + addition.typical,
    high: target.high + addition.high
  };
}

function getStoreyAdjustment(storeys: number): number {
  if (storeys >= 4) {
    return 0.9;
  }
  if (storeys === 3) {
    return 0.92;
  }
  if (storeys === 2) {
    return 0.95;
  }
  return 1;
}

function getBathroomSuiteCount(bedrooms: number): number {
  return Math.max(1, Math.ceil(bedrooms / 2));
}

function getMaterialBasketPerM2(
  spec: NewBuildSpec,
  totalAreaM2: number,
  bedrooms: number,
  supplierPriceOverrides?: SupplierPriceOverrides
): number {
  const area = Math.max(totalAreaM2, 1);
  const priceBand = SPEC_TO_PRICE_BAND[spec];
  const bathrooms = getBathroomSuiteCount(bedrooms);

  const paintPricePerM2 = getEffectivePrice(
    "paint",
    priceBand,
    supplierPriceOverrides?.paint
  );
  const flooringPricePerM2 = getEffectivePrice(
    "laminate_flooring",
    priceBand,
    supplierPriceOverrides?.laminate_flooring
  );
  const kitchenPrice = getEffectivePrice(
    "kitchen_units",
    priceBand,
    supplierPriceOverrides?.kitchen_units
  );
  const bathroomSuitePrice = getEffectivePrice(
    "bathroom_suite",
    priceBand,
    supplierPriceOverrides?.bathroom_suite
  );

  return (
    paintPricePerM2 +
    flooringPricePerM2 +
    kitchenPrice / area +
    (bathroomSuitePrice * bathrooms) / area
  );
}

function initializeCategoryTotals(): Record<NewBuildCategory, TierAmounts> {
  return categoryOrder.reduce<Record<NewBuildCategory, TierAmounts>>((acc, category) => {
    acc[category] = { low: 0, typical: 0, high: 0 };
    return acc;
  }, {} as Record<NewBuildCategory, TierAmounts>);
}

function toCommercialType(
  propertyType: PropertyType
): CommercialTypeValue | undefined {
  switch (propertyType) {
    case PropertyType.OFFICE:
      return "office";
    case PropertyType.RETAIL:
      return "retail";
    case PropertyType.INDUSTRIAL:
      return "industrial";
    case PropertyType.LEISURE:
      return "leisure";
    case PropertyType.HEALTHCARE:
      return "healthcare";
    default:
      return undefined;
  }
}

function validateNewBuildInput(input: NewBuildInput) {
  if (!Number.isFinite(input.totalAreaM2) || input.totalAreaM2 <= 0 || input.totalAreaM2 > 10000) {
    throw new Error("Total area must be between 1 and 10,000 square metres");
  }

  if (!Number.isFinite(input.bedrooms) || input.bedrooms < 1 || input.bedrooms > 20) {
    throw new Error("Bedrooms must be between 1 and 20");
  }

  if (input.postcodeDistrict.trim().length === 0) {
    throw new Error("Postcode district is required");
  }

  const storeyLimit =
    isCommercialPropertyType(input.propertyType) ||
    isFlatLikePropertyType(input.propertyType)
      ? 20
      : 5;
  if (!Number.isFinite(input.storeys) || input.storeys < 1 || input.storeys > storeyLimit) {
    throw new Error(`Storeys must be between 1 and ${storeyLimit}`);
  }

  if (input.numberOfUnits !== undefined && input.numberOfUnits < 2) {
    throw new Error("Developments with units must include at least 2 units");
  }

  if (input.numberOfLettableRooms !== undefined && input.numberOfLettableRooms < 3) {
    throw new Error("Lettable rooms must be at least 3");
  }

  if (isCommercialPropertyType(input.propertyType) && input.parkingSpaces !== undefined) {
    if (input.parkingSpaces < 0 || input.parkingSpaces > 500) {
      throw new Error("Parking spaces must be between 0 and 500");
    }
  }
}

export function calculateNewBuild(input: NewBuildInput): NewBuildResult {
  validateNewBuildInput(input);

  const normalizedPostcode = input.postcodeDistrict.trim().toUpperCase();
  const region = postcodeToRegion(normalizedPostcode);
  const regionalMultiplier = defaultCostLibrary.regionalMultipliers[region];

  const storeyCount = input.numberOfStoreys ?? input.storeys;
  const baseRate = baseBuildRates[input.propertyType][input.spec];
  const materialBasketPerM2 = getMaterialBasketPerM2(
    input.spec,
    input.totalAreaM2,
    input.bedrooms,
    input.supplierPriceOverrides
  );
  const defaultMaterialBasketPerM2 = getMaterialBasketPerM2(
    input.spec,
    input.totalAreaM2,
    input.bedrooms
  );
  const materialAdjustmentPerM2 = materialBasketPerM2 - defaultMaterialBasketPerM2;
  const adjustedBaseRate: TierAmounts = {
    low: Math.max(0, baseRate.low + materialAdjustmentPerM2),
    typical: Math.max(0, baseRate.typical + materialAdjustmentPerM2),
    high: Math.max(0, baseRate.high + materialAdjustmentPerM2)
  };
  const storeyAdjustment = getStoreyAdjustment(storeyCount);

  let baseCost = multiplyTier(
    adjustedBaseRate,
    input.totalAreaM2 * regionalMultiplier * storeyAdjustment
  );

  const adjustments: Array<{ label: string; amount: number; reason: string }> = [];

  if (input.numberOfUnits && input.numberOfUnits > 10) {
    const discount = multiplyTier(baseCost, -0.05);
    adjustments.push({
      label: "Economies of scale discount",
      amount: Math.round(discount.typical),
      reason: "Large multi-unit developments benefit from procurement efficiencies."
    });
    baseCost = multiplyTier(baseCost, 0.95);
  }

  const categoryTotals = initializeCategoryTotals();

  categoryOrder.forEach((category) => {
    if (category === "contingency" || category === "professional_fees") {
      return;
    }
    const share = newBuildCategoryPercents[category];
    const allocation = multiplyTier(baseCost, share);
    categoryTotals[category] = addTier(categoryTotals[category], allocation);
  });

  const addAdjustment = (
    category: NewBuildCategory,
    amounts: TierAmounts,
    label: string,
    reason: string
  ) => {
    categoryTotals[category] = addTier(categoryTotals[category], amounts);
    adjustments.push({
      label,
      amount: Math.round(amounts.typical),
      reason
    });
  };

  const includeGarage =
    Boolean(input.garage) &&
    !isFlatLikePropertyType(input.propertyType) &&
    !isCommercialPropertyType(input.propertyType);
  const includeBasement =
    Boolean(input.basementIncluded) &&
    !isFlatLikePropertyType(input.propertyType) &&
    !isCommercialPropertyType(input.propertyType);

  if (includeGarage) {
    const garageAmounts = multiplyTier(garageCost, regionalMultiplier);
    addAdjustment(
      "external_works",
      garageAmounts,
      "Garage",
      "Garage construction with basic finishes."
    );
  }

  if (input.renewableEnergy) {
    const renewableAmounts = multiplyTier(renewableCost, regionalMultiplier);
    addAdjustment(
      "electrics",
      renewableAmounts,
      "Renewable energy",
      "Solar PV and/or air source heat pump installation."
    );
  }

  if (includeBasement) {
    const basementAmounts = multiplyTier(
      basementPerM2,
      input.totalAreaM2 * 0.7 * regionalMultiplier
    );
    addAdjustment(
      "substructure",
      basementAmounts,
      "Basement construction",
      "Basement excavation and waterproofing to ~70% of footprint."
    );
  }

  if (input.numberOfUnits && input.numberOfUnits >= 2) {
    if (input.liftIncluded) {
      const liftsRequired = Math.max(1, Math.ceil(input.numberOfUnits / 10));
      const liftAmounts = multiplyTier(liftCost, regionalMultiplier * liftsRequired);
      addAdjustment(
        "superstructure",
        liftAmounts,
        "Passenger lift",
        `Includes ${liftsRequired} lift(s) for multi-storey access.`
      );
    }

    if (input.commercialGroundFloor) {
      const groundFloorArea = input.totalAreaM2 / storeyCount;
      const premiumAmounts = multiplyTier(
        adjustedBaseRate,
        groundFloorArea * 0.15 * regionalMultiplier
      );
      addAdjustment(
        "external_envelope",
        premiumAmounts,
        "Commercial ground floor premium",
        "Enhanced structural and façade requirements for mixed-use ground floor."
      );
    }
  }

  if (input.numberOfLettableRooms !== undefined) {
    const numberOfRooms = input.numberOfLettableRooms;
    const fireSafetyAmounts = multiplyTier(fireSafetyCost, regionalMultiplier);
    addAdjustment(
      "preliminaries",
      fireSafetyAmounts,
      "Rental fire safety package",
      "Fire doors, alarm systems, emergency lighting, and signage."
    );

    if (input.enSuitePerRoom) {
      const enSuiteAmounts = multiplyTier(
        enSuiteCostPerRoom,
        numberOfRooms * regionalMultiplier
      );
      addAdjustment(
        "bathrooms",
        enSuiteAmounts,
        "En-suite bathrooms",
        "Private shower rooms for each lettable room."
      );
    }

    if (input.fireEscapeRequired || input.storeys >= 3) {
      const fireEscapeAmounts = multiplyTier(fireEscapeCost, regionalMultiplier);
      addAdjustment(
        "external_works",
        fireEscapeAmounts,
        "External fire escape",
        "Required for multi-storey rental compliance."
      );
    }

    const meteringAmounts = multiplyTier(
      meteringCostPerRoom,
      numberOfRooms * regionalMultiplier
    );
    addAdjustment(
      "electrics",
      meteringAmounts,
      "Utility metering",
      "Separate utility metering per room."
    );

    addAdjustment(
      "preliminaries",
      licensingCost,
      "Rental licensing",
      "Council licensing and compliance fees."
    );
  }

  if (isCommercialPropertyType(input.propertyType)) {
    const fitOutLevel = input.fitOutLevel ?? "cat_a";
    const fitOutAmounts = multiplyTier(
      fitOutRates[fitOutLevel],
      input.totalAreaM2 * regionalMultiplier
    );
    addAdjustment(
      "internal_finishes",
      fitOutAmounts,
      "Commercial fit-out",
      `Fit-out level: ${fitOutLevel.replace("_", " ").toUpperCase()}.`
    );

    if (input.disabledAccess) {
      const ddaAmounts = multiplyTier(ddaCost, regionalMultiplier);
      addAdjustment(
        "preliminaries",
        ddaAmounts,
        "DDA compliance",
        "Accessible WC, ramps/lifts, and compliant door widths."
      );
    }

    if (input.extractionSystem) {
      const extractionAmounts = multiplyTier(extractionCost, regionalMultiplier);
      addAdjustment(
        "plumbing_and_heating",
        extractionAmounts,
        "Commercial extraction",
        "Kitchen extraction and ventilation system."
      );
    }

    if (input.parkingSpaces && input.parkingSpaces > 0) {
      const parkingAmounts = multiplyTier(
        parkingCostPerSpace,
        input.parkingSpaces * regionalMultiplier
      );
      addAdjustment(
        "external_works",
        parkingAmounts,
        "Parking provision",
        "Surface parking construction."
      );
    }
  }

  const subtotal = categoryOrder.reduce<TierAmounts>(
    (acc, category) => {
      if (category === "contingency" || category === "professional_fees") {
        return acc;
      }
      return addTier(acc, categoryTotals[category]);
    },
    { low: 0, typical: 0, high: 0 }
  );

  const contingencyPercent = input.spec === "premium" ? 12 : 10;
  const feesPercent = 12;
  const contingencyAmounts = multiplyTier(subtotal, contingencyPercent / 100);
  const feeAmounts = multiplyTier(subtotal, feesPercent / 100);

  categoryTotals.contingency = addTier(categoryTotals.contingency, contingencyAmounts);
  categoryTotals.professional_fees = addTier(
    categoryTotals.professional_fees,
    feeAmounts
  );

  const total = addTier(addTier(subtotal, contingencyAmounts), feeAmounts);

  const roundedTotals: TierAmounts = {
    low: Math.round(total.low),
    typical: Math.round(total.typical),
    high: Math.round(total.high)
  };

  const roundedByTier: Record<Tier, Record<NewBuildCategory, number>> = {
    low: {} as Record<NewBuildCategory, number>,
    typical: {} as Record<NewBuildCategory, number>,
    high: {} as Record<NewBuildCategory, number>
  };

  for (const tier of TIERS) {
    let runningSum = 0;
    for (const category of categoryOrder) {
      if (category === "professional_fees") {
        continue;
      }
      const roundedValue = Math.round(categoryTotals[category][tier]);
      roundedByTier[tier][category] = roundedValue;
      runningSum += roundedValue;
    }
    roundedByTier[tier].professional_fees = roundedTotals[tier] - runningSum;
  }

  const categories = categoryOrder.map((category) => ({
    category,
    low: roundedByTier.low[category],
    typical: roundedByTier.typical[category],
    high: roundedByTier.high[category]
  }));

  const costPerM2 = {
    low: Math.round(roundedTotals.low / input.totalAreaM2),
    typical: Math.round(roundedTotals.typical / input.totalAreaM2),
    high: Math.round(roundedTotals.high / input.totalAreaM2)
  };

  const metadata: NewBuildResult["metadata"] = {
    propertyType: input.propertyType,
    spec: input.spec,
    bedrooms: input.bedrooms,
    storeys: storeyCount,
    postcodeDistrict: normalizedPostcode,
    estimatedAt: new Date().toISOString()
  };

  if (input.numberOfUnits && input.numberOfUnits >= 2) {
    metadata.numberOfUnits = input.numberOfUnits;
    metadata.costPerUnit = {
      low: Math.round(roundedTotals.low / input.numberOfUnits),
      typical: Math.round(roundedTotals.typical / input.numberOfUnits),
      high: Math.round(roundedTotals.high / input.numberOfUnits)
    };
  }

  if (input.numberOfLettableRooms && input.numberOfLettableRooms >= 3) {
    metadata.numberOfLettableRooms = input.numberOfLettableRooms;
    metadata.costPerLettableRoom = {
      low: Math.round(roundedTotals.low / input.numberOfLettableRooms),
      typical: Math.round(roundedTotals.typical / input.numberOfLettableRooms),
      high: Math.round(roundedTotals.high / input.numberOfLettableRooms)
    };
  }

  if (isCommercialPropertyType(input.propertyType)) {
    metadata.commercialType = toCommercialType(input.propertyType);
    metadata.fitOutLevel = input.fitOutLevel ?? "cat_a";
  }

  return {
    totalLow: roundedTotals.low,
    totalTypical: roundedTotals.typical,
    totalHigh: roundedTotals.high,
    costPerM2,
    categories,
    adjustments,
    contingencyPercent,
    feesPercent,
    region,
    metadata
  };
}
