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
    process.env.OPENAI_API_KEY = "openai-test-key";
    Object.assign(process.env, overrides);
  }

  test("throws when OPENAI_API_KEY is missing", () => {
    delete process.env.OPENAI_API_KEY;

    expect(() => getServerAiEnv()).toThrow("OPENAI_API_KEY");
  });

  test("returns validated env when OPENAI_API_KEY is set", () => {
    setServerEnv();

    const env = getServerAiEnv();

    expect(env.OPENAI_API_KEY).toBe("openai-test-key");
  });

  test("returns default for OPENAI_MODEL when not set", () => {
    setServerEnv();
    delete process.env.OPENAI_MODEL;

    const env = getServerAiEnv();

    expect(env.OPENAI_MODEL).toBe("gpt-4o-mini");
  });

  test("uses provided OPENAI_MODEL when set", () => {
    setServerEnv({ OPENAI_MODEL: "gpt-4.1-mini" });

    const env = getServerAiEnv();

    expect(env.OPENAI_MODEL).toBe("gpt-4.1-mini");
  });

  test("returns default for USE_OPENAI when not set", () => {
    setServerEnv();
    delete process.env.USE_OPENAI;

    const env = getServerAiEnv();

    expect(env.USE_OPENAI).toBe(true);
  });

  test("parses USE_OPENAI=false", () => {
    setServerEnv({ USE_OPENAI: "false" });

    const env = getServerAiEnv();

    expect(env.USE_OPENAI).toBe(false);
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
