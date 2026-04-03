jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn()
}));

describe("getAI", () => {
  const originalGeminiApiKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    if (originalGeminiApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiApiKey;
    }
    jest.resetModules();
    jest.clearAllMocks();
  });

  test("throws when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(import("./gemini").then(({ getAI }) => getAI())).rejects.toThrow(
      "[gemini] GEMINI_API_KEY is not set."
    );
  });

  test("creates and caches the Gemini client using a trimmed API key", async () => {
    process.env.GEMINI_API_KEY = "  test-key  ";

    const { GoogleGenAI } = await import("@google/genai");
    const { getAI } = await import("./gemini");

    const firstClient = getAI();
    const secondClient = getAI();

    expect(GoogleGenAI).toHaveBeenCalledTimes(1);
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(secondClient).toBe(firstClient);
  });
});
