import { z } from "zod";

const serverEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  HUGGINGFACE_PRICING_API_KEY: z.string().min(1, "HUGGINGFACE_PRICING_API_KEY is required"),
  HUGGINGFACE_REFURB_DESIGN_KEY: z.string().min(1, "HUGGINGFACE_REFURB_DESIGN_KEY is required"),
  OPENAI_DESIGNER_MODEL: z.string().min(1).default("gpt-4.1")
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_API_BASE_URL: z.string().optional()
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

function formatErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

let cachedServerEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const result = serverEnvSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    HUGGINGFACE_PRICING_API_KEY: process.env.HUGGINGFACE_PRICING_API_KEY,
    HUGGINGFACE_REFURB_DESIGN_KEY: process.env.HUGGINGFACE_REFURB_DESIGN_KEY,
    OPENAI_DESIGNER_MODEL: process.env.OPENAI_DESIGNER_MODEL
  });

  if (!result.success) {
    throw new Error(
      `Missing or invalid server environment variables:\n${formatErrors(result.error)}`
    );
  }

  cachedServerEnv = result.data;
  return cachedServerEnv;
}

let cachedClientEnv: ClientEnv | undefined;

export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) {
    return cachedClientEnv;
  }

  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL
  });

  if (!result.success) {
    throw new Error(
      `Missing or invalid client environment variables:\n${formatErrors(result.error)}`
    );
  }

  cachedClientEnv = result.data;
  return cachedClientEnv;
}

/**
 * Reset cached env values. Only intended for use in tests.
 */
export function _resetEnvCache(): void {
  cachedServerEnv = undefined;
  cachedClientEnv = undefined;
}
