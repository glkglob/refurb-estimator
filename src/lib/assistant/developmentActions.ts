import type { AssistantAction } from "@/lib/assistant/schemas";
import type { AppraisalInput } from "@/lib/developmentAppraisal";

type DevelopmentField = keyof AppraisalInput;

type ApplyDevelopmentActionsResult = {
  nextInput: AppraisalInput;
  changedFields: DevelopmentField[];
  shouldRecalculate: boolean;
  noneReason: string | null;
};

const EDITABLE_DEVELOPMENT_FIELDS: ReadonlySet<DevelopmentField> = new Set([
  "purchasePrice",
  "grossDevelopmentValue",
  "acquisitionLegalFees",
  "buildCosts",
  "professionalFees",
  "planningCosts",
  "contingencyPercent",
  "includeFinance",
  "bridgingRateMonthlyPercent",
  "loanTermMonths",
  "loanToValuePercent",
  "saleLegalFees",
  "estateAgentFeePercent",
  "targetProfitMarginPercent"
]);

function coerceDevelopmentFieldValue(
  field: DevelopmentField,
  value: unknown
): AppraisalInput[DevelopmentField] | null {
  if (field === "includeFinance") {
    return typeof value === "boolean" ? value : null;
  }

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value as AppraisalInput[DevelopmentField];
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0
      ? (parsed as AppraisalInput[DevelopmentField])
      : null;
  }

  return null;
}

export function applyEditorActionsToDevelopmentInput(
  input: AppraisalInput,
  actions: AssistantAction[]
): ApplyDevelopmentActionsResult {
  const nextInput: AppraisalInput = { ...input };
  const changedFieldSet = new Set<DevelopmentField>();
  let shouldRecalculate = false;
  let noneReason: string | null = null;

  for (const action of actions) {
    if (action.type === "none") {
      noneReason = action.reason ?? null;
      continue;
    }

    if (action.type === "recalculate") {
      shouldRecalculate = true;
      continue;
    }

    if (action.type !== "update_fields") {
      continue;
    }

    for (const [field, value] of Object.entries(action.fields)) {
      if (!EDITABLE_DEVELOPMENT_FIELDS.has(field as DevelopmentField)) {
        continue;
      }

      const typedField = field as DevelopmentField;
      const coercedValue = coerceDevelopmentFieldValue(typedField, value);
      if (coercedValue === null) {
        continue;
      }

      const currentValue = (nextInput as unknown as Record<string, unknown>)[typedField];
      if (Object.is(currentValue, coercedValue)) {
        continue;
      }

      (nextInput as unknown as Record<string, unknown>)[typedField] = coercedValue;
      changedFieldSet.add(typedField);
    }
  }

  if (changedFieldSet.size > 0) {
    shouldRecalculate = true;
  }

  return {
    nextInput,
    changedFields: [...changedFieldSet],
    shouldRecalculate,
    noneReason
  };
}
