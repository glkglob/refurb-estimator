import type { ZodIssue, ZodSchema } from "zod";

export type ValidationError = {
  code: "VALIDATION_ERROR";
  issues: ZodIssue[];
};

export function isValidationError(error: unknown): error is ValidationError {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const candidate = error as Partial<ValidationError>;
  return candidate.code === "VALIDATION_ERROR" && Array.isArray(candidate.issues);
}

function toValidationError(issues: ZodIssue[]): ValidationError {
  return {
    code: "VALIDATION_ERROR",
    issues,
  };
}

export function validate<T>(data: unknown, schema: ZodSchema<T>): T {
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    throw toValidationError(parsed.error.issues);
  }

  return parsed.data;
}
