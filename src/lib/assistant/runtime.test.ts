import {
  buildAssistantPrompt,
  filterAllowedFields,
  getResponseSchema,
  getSystemPrompt,
  isAllowedFieldForMode,
  sanitizeAssistantActions,
  sanitizeAssistantActionsWithReport
} from "./runtime";

describe("assistant runtime helpers", () => {
  test("buildAssistantPrompt embeds runtime context and whitelist", () => {
    const prompt = buildAssistantPrompt({
      systemPrompt: "SYSTEM",
      mode: "development",
      message: "please reduce finance costs",
      estimateInput: { purchasePrice: 200000 },
      estimateResult: { totalCosts: 250000 },
      projectContext: { scenarioId: "sc-1" }
    });

    expect(prompt).toContain("SYSTEM");
    expect(prompt).toContain("mode: development");
    expect(prompt).toContain("allowedFields:");
    expect(prompt).toContain("purchasePrice");
    expect(prompt).toContain("User message: please reduce finance costs");
  });

  test("returns system prompts and response schemas by agent", () => {
    expect(getSystemPrompt("chat")).toContain("Estimate Chat Assistant");
    expect(getSystemPrompt("editor")).toContain("Estimate Editor");
    expect(getSystemPrompt("copilot")).toContain("Project Copilot");

    expect(getResponseSchema("chat").safeParse({ reply: "ok" }).success).toBe(true);
    expect(getResponseSchema("editor").safeParse({ reply: "ok", actions: [] }).success).toBe(true);
    expect(getResponseSchema("copilot").safeParse({ reply: "ok" }).success).toBe(true);
  });

  test("filters update_fields by mode whitelist including indexed room paths", () => {
    expect(isAllowedFieldForMode("rooms", "rooms[0].roomType")).toBe(true);
    expect(isAllowedFieldForMode("rooms", "rooms[0].unknown")).toBe(false);
    expect(isAllowedFieldForMode("development", "hackField")).toBe(false);

    const filtered = filterAllowedFields("development", {
      purchasePrice: 300000,
      targetProfitMarginPercent: 20,
      hackField: "drop-me"
    });

    expect(filtered).toEqual({
      purchasePrice: 300000,
      targetProfitMarginPercent: 20
    });
  });

  test("sanitizes actions and enforces trailing recalculate for state changes", () => {
    const sanitized = sanitizeAssistantActions(
      "development",
      [
        {
          type: "update_fields",
          fields: {
            purchasePrice: 350000,
            unlisted: 123
          }
        },
        { type: "add_room", room: { roomType: "Kitchen" } },
        { type: "none", reason: "ignored when edits exist" }
      ],
      { enforceRecalculate: true }
    );

    expect(sanitized).toEqual([
      {
        type: "update_fields",
        fields: {
          purchasePrice: 350000
        }
      },
      { type: "recalculate" }
    ]);
  });

  test("reports dropped fields and dropped action types for observability", () => {
    const sanitized = sanitizeAssistantActionsWithReport(
      "new_build",
      [
        {
          type: "update_fields",
          fields: {
            spec: "basic",
            unknownField: 1
          }
        },
        { type: "remove_room", roomId: "room-1" }
      ],
      { enforceRecalculate: true }
    );

    expect(sanitized.actions).toEqual([
      {
        type: "update_fields",
        fields: {
          spec: "basic"
        }
      },
      { type: "recalculate" }
    ]);
    expect(sanitized.droppedFields).toEqual(["unknownField"]);
    expect(sanitized.droppedActions).toEqual(["remove_room"]);
  });
});
