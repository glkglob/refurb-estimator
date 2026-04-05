import { z } from "zod";

/**
 * Core server environment variables.
 * Keep this minimal: only things required for non-AI server features
 * (e.g., Supabase service role for share links).
 */
const serverCoreEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
});

/**
 * AI server environment variables.
 * Only required for endpoints that actually call AI providers.
 * All AI is now handled by Google Gemini — no OpenAI or HuggingFace keys.
 */
const serverAiEnvSchema = z.object({
  GEMINI_API_KEY: z
    .string()
    .min(1, "GEMINI_API_KEY is required"),
  /** Override the default Gemini model (defaults to gemini-2.0-flash). */
  GEMINI_MODEL: z.string().min(1).default("gemini-2.0-flash"),
  /** Override the model used by the design-metadata service. */
  GEMINI_DESIGN_MODEL: z.string().min(1).default("gemini-2.0-flash"),
  /** Override the model used for vision / photo-estimate. */
  GEMINI_VISION_MODEL: z.string().min(1).default("gemini-2.0-flash"),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_API_BASE_URL: z.string().optional(),
});

export type ServerCoreEnv = z.infer<typeof serverCoreEnvSchema>;
export type ServerAiEnv = z.infer<typeof serverAiEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

type EnvScope = "server core" | "server ai" | "client";

type ParseEnvArgs<T> = {
  schema: z.ZodSchema<T>;
  values: unknown;
  scope: EnvScope;
};

function formatErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

function parseEnv<T>({ schema, values, scope }: ParseEnvArgs<T>): T {
  const result = schema.safeParse(values);

  if (!result.success) {
    throw new Error(
      `Missing or invalid ${scope} environment variables:\n${formatErrors(result.error)}`,
    );
  }

  return result.data;
}

function readServerCoreEnv(): ServerCoreEnv {
  return parseEnv({
    schema: serverCoreEnvSchema,
    scope: "server core",
    values: {
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
}

function readServerAiEnv(): ServerAiEnv {
  return parseEnv({
    schema: serverAiEnvSchema,
    scope: "server ai",
    values: {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
      GEMINI_DESIGN_MODEL: process.env.GEMINI_DESIGN_MODEL,
      GEMINI_VISION_MODEL: process.env.GEMINI_VISION_MODEL,
    },
  });
}

function readClientEnv(): ClientEnv {
  return parseEnv({
    schema: clientEnvSchema,
    scope: "client",
    values: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    },
  });
}

let cachedServerCoreEnv: ServerCoreEnv | undefined;
let cachedServerAiEnv: ServerAiEnv | undefined;
let cachedClientEnv: ClientEnv | undefined;

export function getServerCoreEnv(): ServerCoreEnv {
  if (!cachedServerCoreEnv) {
    cachedServerCoreEnv = readServerCoreEnv();
  }
  return cachedServerCoreEnv;
}

export function getServerAiEnv(): ServerAiEnv {
  if (!cachedServerAiEnv) {
    cachedServerAiEnv = readServerAiEnv();
  }
  return cachedServerAiEnv;
}

export function getClientEnv(): ClientEnv {
  if (!cachedClientEnv) {
    cachedClientEnv = readClientEnv();
  }
  return cachedClientEnv;
}

/**
 * Reset cached env values. Only intended for use in tests.
 */
export function _resetEnvCache(): void {
  cachedServerCoreEnv = undefined;
  cachedServerAiEnv = undefined;
  cachedClientEnv = undefined;
}
