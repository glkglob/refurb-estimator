export type ViabilityStatus = "viable" | "marginal" | "unviable";

export interface AppraisalInput {
  purchasePrice: number;
  grossDevelopmentValue: number;
  acquisitionLegalFees: number;
  buildCosts: number;
  professionalFees: number;
  planningCosts: number;
  contingencyPercent: number;
  includeFinance: boolean;
  bridgingRateMonthlyPercent: number;
  loanTermMonths: number;
  loanToValuePercent: number;
  saleLegalFees: number;
  estateAgentFeePercent: number;
  targetProfitMarginPercent: number;
}

export interface AppraisalResult {
  stampDutyLandTax: number;
  contingencyCost: number;
  financeTotal: number;
  estateAgentFee: number;
  totalCosts: number;
  grossProfit: number;
  grossProfitPercent: number;
  returnOnCost: number;
  viability: ViabilityStatus;
  brrr: {
    refinanceValueAt75Percent: number;
    equityReleased: number;
  };
  costBreakdown: {
    purchasePrice: number;
    stampDutyLandTax: number;
    acquisitionLegalFees: number;
    buildCosts: number;
    professionalFees: number;
    planningCosts: number;
    contingencyCost: number;
    financeTotal: number;
    saleLegalFees: number;
    estateAgentFee: number;
  };
}

type SdltBand = {
  upperLimit: number;
  rate: number;
};

const SDLT_2025_26_RESIDENTIAL_BANDS: SdltBand[] = [
  { upperLimit: 125_000, rate: 0 },
  { upperLimit: 250_000, rate: 0.02 },
  { upperLimit: 925_000, rate: 0.05 },
  { upperLimit: 1_500_000, rate: 0.1 },
  { upperLimit: Number.POSITIVE_INFINITY, rate: 0.12 }
];

const DEVELOPER_ADDITIONAL_PROPERTY_SURCHARGE = 0.03;
const MARGINAL_BUFFER_PERCENT = 5;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertNonNegativeNumber(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
}

function calculateBandedTax(value: number, bands: SdltBand[]): number {
  let tax = 0;
  let lowerLimit = 0;

  for (const band of bands) {
    if (value <= lowerLimit) {
      break;
    }

    const taxableInBand = Math.min(value, band.upperLimit) - lowerLimit;
    if (taxableInBand > 0) {
      tax += taxableInBand * band.rate;
    }
    lowerLimit = band.upperLimit;
  }

  return roundCurrency(tax);
}

export function calculateStampDutyLandTax(
  purchasePrice: number,
  includeAdditionalPropertySurcharge = true
): number {
  assertNonNegativeNumber(purchasePrice, "Purchase price");

  const bands = includeAdditionalPropertySurcharge
    ? SDLT_2025_26_RESIDENTIAL_BANDS.map((band) => ({
        ...band,
        rate: band.rate + DEVELOPER_ADDITIONAL_PROPERTY_SURCHARGE
      }))
    : SDLT_2025_26_RESIDENTIAL_BANDS;

  return calculateBandedTax(purchasePrice, bands);
}

export function calculateDevelopmentAppraisal(input: AppraisalInput): AppraisalResult {
  assertNonNegativeNumber(input.purchasePrice, "Purchase price");
  assertNonNegativeNumber(input.grossDevelopmentValue, "Gross development value");
  assertNonNegativeNumber(input.acquisitionLegalFees, "Acquisition legal fees");
  assertNonNegativeNumber(input.buildCosts, "Build costs");
  assertNonNegativeNumber(input.professionalFees, "Professional fees");
  assertNonNegativeNumber(input.planningCosts, "Planning costs");
  assertNonNegativeNumber(input.contingencyPercent, "Contingency percent");
  assertNonNegativeNumber(input.bridgingRateMonthlyPercent, "Bridging rate");
  assertNonNegativeNumber(input.loanTermMonths, "Loan term");
  assertNonNegativeNumber(input.loanToValuePercent, "Loan to value");
  assertNonNegativeNumber(input.saleLegalFees, "Sale legal fees");
  assertNonNegativeNumber(input.estateAgentFeePercent, "Estate agent fee percent");
  assertNonNegativeNumber(input.targetProfitMarginPercent, "Target profit margin percent");

  const stampDutyLandTax = calculateStampDutyLandTax(input.purchasePrice, true);
  const contingencyCost = roundCurrency(
    input.buildCosts * (input.contingencyPercent / 100)
  );
  const estateAgentFee = roundCurrency(
    input.grossDevelopmentValue * (input.estateAgentFeePercent / 100)
  );

  const financePrincipal = input.purchasePrice * (input.loanToValuePercent / 100);
  const financeTotal = input.includeFinance
    ? roundCurrency(
        financePrincipal *
          (input.bridgingRateMonthlyPercent / 100) *
          input.loanTermMonths
      )
    : 0;

  const totalCosts = roundCurrency(
    input.purchasePrice +
      stampDutyLandTax +
      input.acquisitionLegalFees +
      input.buildCosts +
      input.professionalFees +
      input.planningCosts +
      contingencyCost +
      financeTotal +
      input.saleLegalFees +
      estateAgentFee
  );

  const grossProfit = roundCurrency(input.grossDevelopmentValue - totalCosts);
  const grossProfitPercent =
    input.grossDevelopmentValue === 0
      ? 0
      : roundCurrency((grossProfit / input.grossDevelopmentValue) * 100);
  const returnOnCost =
    totalCosts === 0 ? 0 : roundCurrency((grossProfit / totalCosts) * 100);

  let viability: ViabilityStatus = "unviable";
  if (grossProfitPercent >= input.targetProfitMarginPercent) {
    viability = "viable";
  } else if (
    grossProfitPercent >= input.targetProfitMarginPercent - MARGINAL_BUFFER_PERCENT
  ) {
    viability = "marginal";
  }

  const refinanceValueAt75Percent = roundCurrency(input.grossDevelopmentValue * 0.75);
  const equityReleased = roundCurrency(refinanceValueAt75Percent - totalCosts);

  return {
    stampDutyLandTax,
    contingencyCost,
    financeTotal,
    estateAgentFee,
    totalCosts,
    grossProfit,
    grossProfitPercent,
    returnOnCost,
    viability,
    brrr: {
      refinanceValueAt75Percent,
      equityReleased
    },
    costBreakdown: {
      purchasePrice: input.purchasePrice,
      stampDutyLandTax,
      acquisitionLegalFees: input.acquisitionLegalFees,
      buildCosts: input.buildCosts,
      professionalFees: input.professionalFees,
      planningCosts: input.planningCosts,
      contingencyCost,
      financeTotal,
      saleLegalFees: input.saleLegalFees,
      estateAgentFee
    }
  };
}
