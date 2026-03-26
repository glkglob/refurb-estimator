import { z } from "zod";
import { getRequestId, jsonError, jsonSuccess, logError } from "@/lib/api-route";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { insertTelemetryEvent } from "@/lib/supabase/telemetry-db";
import { validateJsonRequest } from "@/lib/validate";

const ROUTE_TAG = "api/v1/telemetry";

const telemetryPayloadSchema = z.object({
  eventName: z.string().trim().min(1).max(120),
  properties: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const parsed = await validateJsonRequest(request, telemetryPayloadSchema, {
      errorMessage: "Invalid telemetry payload"
    });

    if (!parsed.success) {
      return parsed.response;
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    await insertTelemetryEvent({
      eventName: parsed.data.eventName,
      userId: user?.id ?? null,
      properties: parsed.data.properties ?? parsed.data.metadata ?? {}
    }, supabase);

    return jsonSuccess({ success: true }, requestId, 202);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to store telemetry event";
    logError(ROUTE_TAG, requestId, error);
    return jsonError(message, requestId, 500);
  }
}
