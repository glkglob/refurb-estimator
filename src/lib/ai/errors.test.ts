import { mapAiProviderError } from "./errors";

describe("mapAiProviderError", () => {
  test("maps missing API key to 500", () => {
    const result = mapAiProviderError(
      new Error("[openai] OPENAI_API_KEY is not set."),
      "fallback"
    );

    expect(result.status).toBe(500);
    expect(result.message).toContain("AI service is not configured");
  });

  test("maps missing model to 502", () => {
    const result = mapAiProviderError(
      { status: 404, message: "Model not found" },
      "fallback"
    );

    expect(result.status).toBe(502);
    expect(result.message).toBe("Configured AI model was not found.");
  });

  test("maps rate limit to 503", () => {
    const result = mapAiProviderError(
      { status: 429, message: "Rate limit exceeded" },
      "fallback"
    );

    expect(result.status).toBe(503);
    expect(result.message).toContain("rate limit");
  });

  test("maps malformed JSON to 502", () => {
    const result = mapAiProviderError(new SyntaxError("Unexpected token"), "fallback");

    expect(result.status).toBe(502);
    expect(result.message).toBe("AI provider returned malformed JSON.");
  });

  test("maps network failures to 503", () => {
    const result = mapAiProviderError(new Error("Network request failed"), "fallback");

    expect(result.status).toBe(503);
    expect(result.message).toContain("Network error");
  });

  test("uses fallback for unknown errors", () => {
    const result = mapAiProviderError(new Error("Unhandled failure"), "fallback message");

    expect(result.status).toBe(500);
    expect(result.message).toBe("fallback message");
  });
});
