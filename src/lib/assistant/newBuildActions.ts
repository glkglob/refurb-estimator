import type { NewBuildInput } from "@/lib/types";
import type { AssistantAction } from "@/lib/assistant/schemas";
import { inferPropertyTypeFromText } from "@/lib/propertyType";

type NewBuildField = keyof NewBuildInput;

type ApplyNewBuildActionsResult = {
  nextInput: NewBuildInput;
  changedFields: NewBuildField[];
  shouldRecalculate: boolean;
  noneReason: string | null;
};

const EDITABLE_NEW_BUILD_FIELDS: ReadonlySet<NewBuildField> = new Set([
  "propertyType",
  "spec",
  "totalAreaM2",
  "bedrooms",
  "storeys",
  "postcodeDistrict",
  "garage",
  "renewableEnergy",
  "basementIncluded",
  "numberOfUnits",
  "numberOfStoreys",
  "liftIncluded",
  "commercialGroundFloor",
  "numberOfLettableRooms",
  "enSuitePerRoom",
  "communalKitchen",
  "fireEscapeRequired",
  "commercialType",
  "fitOutLevel",
  "disabledAccess",
  "extractionSystem",
  "parkingSpaces"
]);

const NEW_BUILD_SPECS: ReadonlyArray<NewBuildInput["spec"]> = [
  "basic",
  "standard",
  "premium"
];

const COMMERCIAL_TYPES: ReadonlyArray<NonNullable<NewBuildInput["commercialType"]>> = [
  "office",
  "retail",
  "industrial",
  "leisure",
  "healthcare"
];

const FIT_OUT_LEVELS: ReadonlyArray<NonNullable<NewBuildInput["fitOutLevel"]>> = [
  "shell_only",
  "cat_a",
  "cat_b"
];

function isOneOf<T extends string>(value: string, allowed: ReadonlyArray<T>): value is T {
  return allowed.includes(value as T);
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function coerceNewBuildFieldValue(field: NewBuildField, value: unknown): NewBuildInput[NewBuildField] | null {
  switch (field) {
    case "propertyType": {
      return inferPropertyTypeFromText(value);
    }
    case "spec":
      return typeof value === "string" && isOneOf(value, NEW_BUILD_SPECS)
        ? value
        : null;
    case "totalAreaM2":
    case "bedrooms":
    case "storeys":
    case "numberOfUnits":
    case "numberOfStoreys":
    case "numberOfLettableRooms":
    case "parkingSpaces": {
      const parsed = parseFiniteNumber(value);
      return parsed !== null ? parsed : null;
    }
    case "postcodeDistrict":
      return typeof value === "string" ? value.trim().toUpperCase() : null;
    case "garage":
    case "renewableEnergy":
    case "basementIncluded":
    case "liftIncluded":
    case "commercialGroundFloor":
    case "enSuitePerRoom":
    case "communalKitchen":
    case "fireEscapeRequired":
    case "disabledAccess":
    case "extractionSystem":
      return typeof value === "boolean" ? value : null;
    case "commercialType":
      return typeof value === "string" && isOneOf(value, COMMERCIAL_TYPES)
        ? value
        : null;
    case "fitOutLevel":
      return typeof value === "string" && isOneOf(value, FIT_OUT_LEVELS)
        ? value
        : null;
    default:
      return null;
  }
}

export function applyEditorActionsToNewBuildInput(
  input: NewBuildInput,
  actions: AssistantAction[]
): ApplyNewBuildActionsResult {
  const nextInput: NewBuildInput = { ...input };
  const changedFieldSet = new Set<NewBuildField>();
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
      if (!EDITABLE_NEW_BUILD_FIELDS.has(field as NewBuildField)) {
        continue;
      }

      const typedField = field as NewBuildField;
      const coercedValue = coerceNewBuildFieldValue(typedField, value);
      if (coercedValue === null) {
        continue;
      }

      const currentValue = (nextInput as Record<string, unknown>)[typedField];
      if (Object.is(currentValue, coercedValue)) {
        continue;
      }

      (nextInput as Record<string, unknown>)[typedField] = coercedValue;
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
