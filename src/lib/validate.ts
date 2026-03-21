import { NextResponse } from "next/server";
import { type z, ZodError } from "zod";

type ValidationErrorBody = {
  error: string;
  details: string[];
};

type ValidationSuccess<T> = {
  success: true;
  data: T;
};

type ValidationFailure = {
  success: false;
  response: NextResponse<ValidationErrorBody>;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

function validationErrorResponse(
  error: string,
  details: string[] = []
): NextResponse<ValidationErrorBody> {
  return NextResponse.json(
    {
      error,
      details
    },
    { status: 400 }
  );
}

export function validateWithSchema<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
  options?: {
    errorMessage?: string;
  }
): ValidationResult<z.infer<TSchema>> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      response: validationErrorResponse(
        options?.errorMessage ?? "Invalid request body",
        parsed.error.issues.map((issue) => issue.message)
      )
    };
  }

  return { success: true, data: parsed.data };
}

export async function validateJsonRequest<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
  options?: {
    invalidJsonMessage?: string;
    errorMessage?: string;
  }
): Promise<ValidationResult<z.infer<TSchema>>> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        response: validationErrorResponse(
          options?.errorMessage ?? "Invalid request body",
          error.issues.map((issue) => issue.message)
        )
      };
    }

    return {
      success: false,
      response: validationErrorResponse(
        options?.invalidJsonMessage ?? "Invalid JSON body"
      )
    };
  }

  return validateWithSchema(schema, payload, {
    errorMessage: options?.errorMessage
  });
}
