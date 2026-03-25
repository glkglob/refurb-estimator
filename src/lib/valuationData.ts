export type RefurbType = "light" | "medium" | "heavy" | "extension" | "loft";

export const upliftFactors: Record<
  RefurbType,
  {
    min: number;
    max: number;
  }
> = {
  light: {
    min: 0.05,
    max: 0.1,
  },
  medium: {
    min: 0.1,
    max: 0.15,
  },
  heavy: {
    min: 0.15,
    max: 0.25,
  },
  extension: {
    min: 0.2,
    max: 0.35,
  },
  loft: {
    min: 0.15,
    max: 0.3,
  },
};

export interface CalculateUpliftInput {
  currentValue: number;
  refurbCost: number;
  refurbType: RefurbType;
}

export interface CalculateUpliftResult {
  upliftMin: number;
  upliftMax: number;
  newValueMin: number;
  newValueMax: number;
  roiMin: number;
  roiMax: number;
}

export type ValuationInput = {
  currentValue: number;
  refurbCost: number;
  expectedValue: number;
};

export type ValuationResult = {
  grossUplift: number;
  netUplift: number;
  roiPercent: number;
};

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite number greater than 0`);
  }
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite number greater than or equal to 0`);
  }
}

export function calculateUplift({
  currentValue,
  refurbCost,
  refurbType,
}: CalculateUpliftInput): CalculateUpliftResult {
  assertFinitePositive(currentValue, "currentValue");
  assertFiniteNonNegative(refurbCost, "refurbCost");

  const factors = upliftFactors[refurbType];

  if (!factors) {
    throw new Error(`Unsupported refurbType: ${refurbType}`);
  }

  const upliftMin = currentValue * factors.min;
  const upliftMax = currentValue * factors.max;

  const newValueMin = currentValue + upliftMin;
  const newValueMax = currentValue + upliftMax;

  const roiMin = refurbCost === 0 ? 0 : upliftMin / refurbCost;
  const roiMax = refurbCost === 0 ? 0 : upliftMax / refurbCost;

  return {
    upliftMin,
    upliftMax,
    newValueMin,
    newValueMax,
    roiMin,
    roiMax,
  };
}

export function calculateValuation({
  currentValue,
  refurbCost,
  expectedValue,
}: ValuationInput): ValuationResult {
  assertFinitePositive(currentValue, "currentValue");
  assertFiniteNonNegative(refurbCost, "refurbCost");
  assertFinitePositive(expectedValue, "expectedValue");

  const grossUplift = expectedValue - currentValue;
  const netUplift = grossUplift - refurbCost;

  const roiPercent = refurbCost === 0 ? 0 : (netUplift / refurbCost) * 100;

  return {
    grossUplift,
    netUplift,
    roiPercent: Number(roiPercent.toFixed(1)),
  };
}
