import { inferAssistantAgentFromMessage } from "./client";

describe("assistant client intent routing", () => {
  test("routes explicit edit requests to editor", () => {
    expect(inferAssistantAgentFromMessage("Make this cheaper but keep resale strong")).toBe(
      "editor"
    );
  });

  test("routes planning requests to copilot", () => {
    expect(inferAssistantAgentFromMessage("What should I do next to de-risk this project?")).toBe(
      "copilot"
    );
  });

  test("routes explanation requests to chat", () => {
    expect(inferAssistantAgentFromMessage("Why is this estimate high?")).toBe("chat");
  });
});
