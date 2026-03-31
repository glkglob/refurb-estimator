/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EstimateAssistantPanel from "./EstimateAssistantPanel";
import {
  inferAssistantAgentFromMessage,
  requestAssistantResponse
} from "@/lib/assistant/client";
import { applyEditorActionsToNewBuildInput } from "@/lib/assistant/newBuildActions";
import { PropertyType } from "@/lib/propertyType";
import type { NewBuildInput, NewBuildResult } from "@/lib/types";

jest.mock("@/lib/assistant/client", () => ({
  inferAssistantAgentFromMessage: jest.fn(),
  requestAssistantResponse: jest.fn()
}));

const mockedInferAssistantAgent = inferAssistantAgentFromMessage as jest.MockedFunction<
  typeof inferAssistantAgentFromMessage
>;
const mockedRequestAssistantResponse = requestAssistantResponse as jest.MockedFunction<
  typeof requestAssistantResponse
>;

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

const BASE_RESULT: NewBuildResult = {
  totalLow: 200000,
  totalTypical: 240000,
  totalHigh: 280000,
  costPerM2: { low: 1667, typical: 2000, high: 2333 },
  categories: [],
  adjustments: [],
  contingencyPercent: 5,
  feesPercent: 8,
  region: "yorkshire_and_humber",
  metadata: {
    propertyType: PropertyType.DETACHED_HOUSE,
    spec: "standard",
    bedrooms: 3,
    storeys: 2,
    postcodeDistrict: "LS1",
    estimatedAt: "2026-03-26T00:00:00.000Z"
  }
};

describe("EstimateAssistantPanel", () => {
  beforeEach(() => {
    mockedInferAssistantAgent.mockReset();
    mockedRequestAssistantResponse.mockReset();
  });

  test("routes edit intent through editor and applies safe state changes", async () => {
    mockedInferAssistantAgent.mockReturnValue("editor");
    mockedRequestAssistantResponse.mockResolvedValueOnce({
      reply: "Adjusted spec to reduce cost while preserving resale quality.",
      actions: [
        {
          type: "update_fields",
          fields: {
            spec: "basic"
          }
        },
        { type: "recalculate" }
      ]
    });

    const onApplyEditorActions = jest.fn();
    let uiInputState = { ...BASE_INPUT };
    onApplyEditorActions.mockImplementation((actions) => {
      const applied = applyEditorActionsToNewBuildInput(uiInputState, actions);
      uiInputState = applied.nextInput;
    });

    const user = userEvent.setup();
    render(
      <EstimateAssistantPanel
        mode="new_build"
        estimateInput={BASE_INPUT}
        estimateResult={BASE_RESULT}
        onApplyEditorActions={onApplyEditorActions}
      />
    );

    await user.type(
      screen.getByPlaceholderText(/ask a question about this estimate/i),
      "Make this cheaper but keep resale strong"
    );
    await user.click(screen.getByRole("button", { name: /Ask assistant/i }));

    await waitFor(() => expect(onApplyEditorActions).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/Adjusted spec to reduce cost/i)).toBeInTheDocument();

    expect(mockedRequestAssistantResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: "editor",
        mode: "new_build",
        message: "Make this cheaper but keep resale strong"
      })
    );

    expect(uiInputState.spec).toBe("basic");
  });

  test("surfaces none action reason and clarification hint in UI", async () => {
    mockedInferAssistantAgent.mockReturnValue("editor");
    mockedRequestAssistantResponse.mockResolvedValueOnce({
      reply: "Which area should be reduced first?",
      actions: [{ type: "none", reason: "Need a specific scope to edit safely." }]
    });

    const user = userEvent.setup();
    render(
      <EstimateAssistantPanel mode="new_build" estimateInput={BASE_INPUT} estimateResult={BASE_RESULT} />
    );

    await user.type(
      screen.getByPlaceholderText(/ask a question about this estimate/i),
      "Change this"
    );
    await user.click(screen.getByRole("button", { name: /Ask assistant/i }));

    expect(await screen.findByText(/Why no edit was applied:/i)).toBeInTheDocument();
    expect(screen.getByText(/Reply with a short follow-up/i)).toBeInTheDocument();
  });
});
