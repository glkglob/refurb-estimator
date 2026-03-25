import {
  getServerAiEnv,
  getServerCoreEnv,
} from "./env";

describe("getServerAiEnv", () => {
  function setServerEnv(overrides: Record<string, string | undefined> = {}) {
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.HUGGINGFACE_PRICING_API_KEY = "hf-test-key";
    process.env.HUGGINGFACE_REFURB_DESIGN_KEY = "hf-test-key";
    Object.assign(process.env, overrides);
  }

  test("throws when OPENAI_API_KEY is missing", () => {
    process.env.HUGGINGFACE_PRICING_API_KEY = "hf-test-key";
    process.env.HUGGINGFACE_REFURB_DESIGN_KEY = "hf-test-key";
    delete process.env.OPENAI_API_KEY;

    expect(() => getServerAiEnv()).toThrow("OPENAI_API_KEY");
  });

  test("throws when HUGGINGFACE_PRICING_API_KEY is missing", () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.HUGGINGFACE_REFURB_DESIGN_KEY = "hf-test-key";
    delete process.env.HUGGINGFACE_PRICING_API_KEY;

    expect(() => getServerAiEnv()).toThrow("HUGGINGFACE_PRICING_API_KEY");
  });

  test("throws when HUGGINGFACE_REFURB_DESIGN_KEY is missing", () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.HUGGINGFACE_PRICING_API_KEY = "hf-test-key";
    delete process.env.HUGGINGFACE_REFURB_DESIGN_KEY;

    expect(() => getServerAiEnv()).toThrow("HUGGINGFACE_REFURB_DESIGN_KEY");
  });

  test("returns validated env when all required vars are set", () => {
    setServerEnv();

    const env = getServerAiEnv();

    expect(env.OPENAI_API_KEY).toBe("sk-test-key");
    expect(env.HUGGINGFACE_PRICING_API_KEY).toBe("hf-test-key");
    expect(env.HUGGINGFACE_REFURB_DESIGN_KEY).toBe("hf-test-key");
  });

  test("returns default for OPENAI_DESIGNER_MODEL when not set", () => {
    setServerEnv();
    delete process.env.OPENAI_DESIGNER_MODEL;

    const env = getServerAiEnv();

    expect(env.OPENAI_DESIGNER_MODEL).toBe("gpt-4.1");
  });

  test("uses provided OPENAI_DESIGNER_MODEL when set", () => {
    setServerEnv({ OPENAI_DESIGNER_MODEL: "gpt-4.1" });

    const env = getServerAiEnv();

    expect(env.OPENAI_DESIGNER_MODEL).toBe("gpt-4.1");
  });
});

describe("getServerCoreEnv", () => {
  test("throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getServerCoreEnv()).toThrow("SUPABASE_SERVICE_ROLE_KEY");
  });

  test("returns validated env when set", () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
    const env = getServerCoreEnv();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("service-role-test-key");
  });
});
