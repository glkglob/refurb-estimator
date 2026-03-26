import {
  calculateDevelopmentAppraisal,
  calculateStampDutyLandTax,
  type AppraisalInput
} from "./developmentAppraisal";

describe("calculateStampDutyLandTax", () => {
  test.each([
    [100_000, 3_000],
    [125_000, 3_750],
    [200_000, 7_500],
    [300_000, 14_000],
    [925_000, 64_000],
    [1_000_000, 73_750],
    [1_500_000, 138_750],
    [2_000_000, 213_750]
  ])(
    "applies 2025/26 residential SDLT bands + 3%% surcharge for purchase price £%d",
    (purchasePrice, expectedSdlt) => {
      expect(calculateStampDutyLandTax(purchasePrice)).toBe(expectedSdlt);
    }
  );
});

describe("calculateDevelopmentAppraisal", () => {
  function buildInput(overrides: Partial<AppraisalInput>): AppraisalInput {
    return {
      purchasePrice: 200_000,
      grossDevelopmentValue: 350_000,
      acquisitionLegalFees: 2_000,
      buildCosts: 100_000,
      professionalFees: 10_000,
      planningCosts: 3_000,
      contingencyPercent: 10,
      includeFinance: true,
      bridgingRateMonthlyPercent: 1,
      loanTermMonths: 9,
      loanToValuePercent: 70,
      saleLegalFees: 2_000,
      estateAgentFeePercent: 1.5,
      targetProfitMarginPercent: 20,
      ...overrides
    };
  }

  test("computes total costs, profit metrics, and BRRR checks accurately", () => {
    const result = calculateDevelopmentAppraisal(buildInput({}));

    expect(result.stampDutyLandTax).toBe(7_500);
    expect(result.contingencyCost).toBe(10_000);
    expect(result.financeTotal).toBe(12_600);
    expect(result.estateAgentFee).toBe(5_250);
    expect(result.totalCosts).toBe(352_350);
    expect(result.grossProfit).toBe(-2_350);
    expect(result.grossProfitPercent).toBeCloseTo(-0.67, 2);
    expect(result.returnOnCost).toBeCloseTo(-0.67, 2);
    expect(result.brrr.refinanceValueAt75Percent).toBe(262_500);
    expect(result.brrr.equityReleased).toBe(-89_850);
    expect(result.viability).toBe("unviable");
  });

  test("sets financeTotal to zero when finance is disabled", () => {
    const result = calculateDevelopmentAppraisal(
      buildInput({
        includeFinance: false
      })
    );

    expect(result.financeTotal).toBe(0);
    expect(result.totalCosts).toBe(339_750);
  });

  test("marks viability as viable when margin is exactly the target", () => {
    const result = calculateDevelopmentAppraisal(
      buildInput({
        purchasePrice: 100_000,
        grossDevelopmentValue: 128_750,
        acquisitionLegalFees: 0,
        buildCosts: 0,
        professionalFees: 0,
        planningCosts: 0,
        contingencyPercent: 0,
        includeFinance: false,
        saleLegalFees: 0,
        estateAgentFeePercent: 0,
        targetProfitMarginPercent: 20
      })
    );

    expect(result.grossProfitPercent).toBe(20);
    expect(result.viability).toBe("viable");
  });

  test("marks viability as marginal when margin is within 5% below target", () => {
    const result = calculateDevelopmentAppraisal(
      buildInput({
        purchasePrice: 100_000,
        grossDevelopmentValue: 121_176.47,
        acquisitionLegalFees: 0,
        buildCosts: 0,
        professionalFees: 0,
        planningCosts: 0,
        contingencyPercent: 0,
        includeFinance: false,
        saleLegalFees: 0,
        estateAgentFeePercent: 0,
        targetProfitMarginPercent: 20
      })
    );

    expect(result.grossProfitPercent).toBe(15);
    expect(result.viability).toBe("marginal");
  });

  test("marks viability as unviable when margin is more than 5% below target", () => {
    const result = calculateDevelopmentAppraisal(
      buildInput({
        purchasePrice: 100_000,
        grossDevelopmentValue: 120_000,
        acquisitionLegalFees: 0,
        buildCosts: 0,
        professionalFees: 0,
        planningCosts: 0,
        contingencyPercent: 0,
        includeFinance: false,
        saleLegalFees: 0,
        estateAgentFeePercent: 0,
        targetProfitMarginPercent: 20
      })
    );

    expect(result.grossProfitPercent).toBeCloseTo(14.17, 2);
    expect(result.viability).toBe("unviable");
  });
});
