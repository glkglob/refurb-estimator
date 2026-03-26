import { applyEditorActionsToNewBuildInput } from "./newBuildActions";
import type { AssistantAction } from "./schemas";
import { PropertyType } from "@/lib/propertyType";
import type { NewBuildInput } from "@/lib/types";

const BASE_INPUT: NewBuildInput = {
  propertyType: PropertyType.DETACHED_HOUSE,
  spec: "standard",
  totalAreaM2: 120,
  bedrooms: 3,
  storeys: 2,
  postcodeDistrict: "LS1",
  garage: false,
  renewableEnergy: false,
  basementIncluded: false
};

describe("applyEditorActionsToNewBuildInput", () => {
  test("applies supported field updates and marks for recalculate", () => {
    const actions: AssistantAction[] = [
      {
        type: "update_fields",
        fields: {
          spec: "basic",
          totalAreaM2: 110,
          unsupportedField: "drop me"
        }
      },
      { type: "recalculate" }
    ];

    const applied = applyEditorActionsToNewBuildInput(BASE_INPUT, actions);

    expect(applied.nextInput.spec).toBe("basic");
    expect(applied.nextInput.totalAreaM2).toBe(110);
    expect(applied.changedFields).toEqual(expect.arrayContaining(["spec", "totalAreaM2"]));
    expect(applied.shouldRecalculate).toBe(true);
  });

  test("returns none reason for UI disclosure when no edit is applied", () => {
    const actions: AssistantAction[] = [{ type: "none", reason: "Need your target budget first." }];

    const applied = applyEditorActionsToNewBuildInput(BASE_INPUT, actions);

    expect(applied.changedFields).toEqual([]);
    expect(applied.noneReason).toBe("Need your target budget first.");
    expect(applied.shouldRecalculate).toBe(false);
  });
});
