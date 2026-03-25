import { z } from "zod";

const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  HUGGINGFACE_PRICING_API_KEY: z
    .string()
    .min(1, "HUGGINGFACE_PRICING_API_KEY is required"),
  HUGGINGFACE_REFURB_DESIGN_KEY: z
    .string()
    .min(1, "HUGGINGFACE_REFURB_DESIGN_KEY is required"),
  OPENAI_DESIGNER_MODEL: z.string().min(1).default("gpt-4.1"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
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

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

type ParseEnvArgs<T> = {
  schema: z.ZodSchema<T>;
  values: unknown;
  scope: "server" | "client";
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

function readServerEnv(): ServerEnv {
  return parseEnv({
    schema: serverEnvSchema,
    scope: "server",
    values: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      HUGGINGFACE_PRICING_API_KEY: process.env.HUGGINGFACE_PRICING_API_KEY,
      HUGGINGFACE_REFURB_DESIGN_KEY: process.env.HUGGINGFACE_REFURB_DESIGN_KEY,
      OPENAI_DESIGNER_MODEL: process.env.OPENAI_DESIGNER_MODEL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
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

let cachedServerEnv: ServerEnv | undefined;
let cachedClientEnv: ClientEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cachedServerEnv) {
    cachedServerEnv = readServerEnv();
  }

  return cachedServerEnv;
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
  cachedServerEnv = undefined;
  cachedClientEnv = undefined;
}
