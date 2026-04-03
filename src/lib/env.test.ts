import {
  _resetEnvCache,
  getServerAiEnv,
  getServerCoreEnv,
} from "./env";

beforeEach(() => {
  _resetEnvCache();
});

afterEach(() => {
  _resetEnvCache();
});

describe("getServerAiEnv", () => {
  function setServerEnv(overrides: Record<string, string | undefined> = {}) {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    Object.assign(process.env, overrides);
  }

  test("throws when GEMINI_API_KEY is missing", () => {
    delete process.env.GEMINI_API_KEY;

    expect(() => getServerAiEnv()).toThrow("GEMINI_API_KEY");
  });

  test("returns validated env when GEMINI_API_KEY is set", () => {
    setServerEnv();

    const env = getServerAiEnv();

    expect(env.GEMINI_API_KEY).toBe("gemini-test-key");
  });

  test("returns default for GEMINI_MODEL when not set", () => {
    setServerEnv();
    delete process.env.GEMINI_MODEL;

    const env = getServerAiEnv();

    expect(env.GEMINI_MODEL).toBe("gemini-2.0-flash");
  });

  test("uses provided GEMINI_MODEL when set", () => {
    setServerEnv({ GEMINI_MODEL: "gemini-1.5-pro" });

    const env = getServerAiEnv();

    expect(env.GEMINI_MODEL).toBe("gemini-1.5-pro");
  });

  test("returns default for GEMINI_DESIGN_MODEL when not set", () => {
    setServerEnv();
    delete process.env.GEMINI_DESIGN_MODEL;

    const env = getServerAiEnv();

    expect(env.GEMINI_DESIGN_MODEL).toBe("gemini-2.0-flash");
  });

  test("returns default for GEMINI_VISION_MODEL when not set", () => {
    setServerEnv();
    delete process.env.GEMINI_VISION_MODEL;

    const env = getServerAiEnv();

    expect(env.GEMINI_VISION_MODEL).toBe("gemini-2.0-flash");
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
