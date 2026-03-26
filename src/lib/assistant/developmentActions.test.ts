import { applyEditorActionsToDevelopmentInput } from "./developmentActions";
import type { AssistantAction } from "./schemas";
import type { AppraisalInput } from "@/lib/developmentAppraisal";

const BASE_INPUT: AppraisalInput = {
  purchasePrice: 250000,
  grossDevelopmentValue: 450000,
  acquisitionLegalFees: 2000,
  buildCosts: 120000,
  professionalFees: 12000,
  planningCosts: 3000,
  contingencyPercent: 10,
  includeFinance: true,
  bridgingRateMonthlyPercent: 1,
  loanTermMonths: 9,
  loanToValuePercent: 70,
  saleLegalFees: 1500,
  estateAgentFeePercent: 1.5,
  targetProfitMarginPercent: 20
};

describe("applyEditorActionsToDevelopmentInput", () => {
  test("applies supported field changes and requests recalculation", () => {
    const actions: AssistantAction[] = [
      {
        type: "update_fields",
        fields: {
          buildCosts: 110000,
          includeFinance: false,
          unsupportedField: true
        }
      }
    ];

    const applied = applyEditorActionsToDevelopmentInput(BASE_INPUT, actions);

    expect(applied.nextInput.buildCosts).toBe(110000);
    expect(applied.nextInput.includeFinance).toBe(false);
    expect("unsupportedField" in (applied.nextInput as object)).toBe(false);
    expect(applied.shouldRecalculate).toBe(true);
  });

  test("tracks none reason when no safe edits are applied", () => {
    const actions: AssistantAction[] = [
      {
        type: "none",
        reason: "Need to know whether to prioritize margin or speed."
      }
    ];

    const applied = applyEditorActionsToDevelopmentInput(BASE_INPUT, actions);

    expect(applied.noneReason).toBe("Need to know whether to prioritize margin or speed.");
    expect(applied.changedFields).toHaveLength(0);
    expect(applied.shouldRecalculate).toBe(false);
  });
});
