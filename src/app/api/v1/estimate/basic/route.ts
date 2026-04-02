import { NextResponse } from "next/server";

import { estimateInputSchema } from "@/schemas/estimate";
import { calculateEstimate } from "@/services/estimate";
import { upsertEstimate } from "@/services/qdrant";
import { isValidationError, validate } from "@/utils/validator";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  try {
    const input = validate(payload, estimateInputSchema);
    const result = calculateEstimate(input);
    const summary = `Estimate region=${input.region} area=${input.area} total=${result.formatted}`;

    let indexed = false;

    try {
      await upsertEstimate({
        id: crypto.randomUUID(),
        estimateInput: input,
        estimateResult: result,
        summary,
      });
      indexed = true;
    } catch (error) {
      if (error instanceof Error && error.message.includes("QDRANT_URL is not configured")) {
        indexed = false;
      } else {
        throw error;
      }
    }

    return NextResponse.json({
      input,
      result,
      indexed,
    });
  } catch (error: unknown) {
    if (isValidationError(error)) {
      return NextResponse.json(
        {
          error: error.code,
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Estimate failed";
    return jsonError(message, 500);
  }
}
