import { getServerEnv, getClientEnv, _resetEnvCache } from "./env";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  _resetEnvCache();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("getServerEnv", () => {
  function setServerEnv(overrides: Record<string, string | undefined> = {}) {
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.GEMINI_API_KEY = "gemini-test-key";
    Object.assign(process.env, overrides);
  }

  test("throws when OPENAI_API_KEY is missing", () => {
    process.env.GEMINI_API_KEY = "gemini-test-key";
    delete process.env.OPENAI_API_KEY;

    expect(() => getServerEnv()).toThrow("OPENAI_API_KEY");
  });

  test("throws when GEMINI_API_KEY is missing", () => {
    process.env.OPENAI_API_KEY = "sk-test-key";
    delete process.env.GEMINI_API_KEY;

    expect(() => getServerEnv()).toThrow("GEMINI_API_KEY");
  });

  test("returns validated env when all required vars are set", () => {
    setServerEnv();

    const env = getServerEnv();

    expect(env.OPENAI_API_KEY).toBe("sk-test-key");
    expect(env.GEMINI_API_KEY).toBe("gemini-test-key");
  });

  test("returns default for OPENAI_DESIGNER_MODEL when not set", () => {
    setServerEnv();
    delete process.env.OPENAI_DESIGNER_MODEL;

    const env = getServerEnv();

    expect(env.OPENAI_DESIGNER_MODEL).toBe("gpt-4.1");
  });

  test("uses provided OPENAI_DESIGNER_MODEL when set", () => {
    setServerEnv({ OPENAI_DESIGNER_MODEL: "gpt-4o" });

    const env = getServerEnv();

    expect(env.OPENAI_DESIGNER_MODEL).toBe("gpt-4o");
  });

  test("optional GEMINI_PRICING_API_KEY is returned when set", () => {
    setServerEnv({ GEMINI_PRICING_API_KEY: "pricing-key" });

    const env = getServerEnv();

    expect(env.GEMINI_PRICING_API_KEY).toBe("pricing-key");
  });

  test("optional GEMINI_PRICING_API_KEY is undefined when not set", () => {
    setServerEnv();

    const env = getServerEnv();

    expect(env.GEMINI_PRICING_API_KEY).toBeUndefined();
  });
});

describe("getClientEnv", () => {
  function setClientEnv(overrides: Record<string, string | undefined> = {}) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    Object.assign(process.env, overrides);
  }

  test("throws when NEXT_PUBLIC_SUPABASE_URL is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    expect(() => getClientEnv()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  test("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => getClientEnv()).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  test("returns validated env when all required vars are set", () => {
    setClientEnv();

    const env = getClientEnv();

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("test-anon-key");
  });

  test("NEXT_PUBLIC_API_BASE_URL is optional", () => {
    setClientEnv();

    const env = getClientEnv();

    expect(env.NEXT_PUBLIC_API_BASE_URL).toBeUndefined();
  });

  test("returns NEXT_PUBLIC_API_BASE_URL when set", () => {
    setClientEnv({ NEXT_PUBLIC_API_BASE_URL: "https://api.example.com" });

    const env = getClientEnv();

    expect(env.NEXT_PUBLIC_API_BASE_URL).toBe("https://api.example.com");
  });
});
