describe("openai helpers", () => {
  const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
  const originalUseOpenAi = process.env.USE_OPENAI;

  afterEach(() => {
    if (originalOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }

    if (originalUseOpenAi === undefined) {
      delete process.env.USE_OPENAI;
    } else {
      process.env.USE_OPENAI = originalUseOpenAi;
    }

    jest.resetModules();
  });

  test("getOpenAIApiKey throws when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(
      import("./openai").then(({ getOpenAIApiKey }) => getOpenAIApiKey())
    ).rejects.toThrow("OPENAI_API_KEY");
  });

  test("getOpenAIApiKey returns trimmed key", async () => {
    process.env.OPENAI_API_KEY = "  test-openai-key  ";
    const { getOpenAIApiKey } = await import("./openai");

    expect(getOpenAIApiKey()).toBe("test-openai-key");
  });

  test("isOpenAIEnabled defaults to true", async () => {
    delete process.env.USE_OPENAI;
    const { isOpenAIEnabled } = await import("./openai");

    expect(isOpenAIEnabled()).toBe(true);
  });

  test("isOpenAIEnabled parses explicit false", async () => {
    process.env.USE_OPENAI = "false";
    const { isOpenAIEnabled } = await import("./openai");

    expect(isOpenAIEnabled()).toBe(false);
  });
});
