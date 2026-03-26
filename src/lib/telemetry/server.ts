import { createServerSupabaseClient } from "@/lib/supabase/server";
import { insertTelemetryEvent } from "@/lib/supabase/telemetry-db";

type ServerTelemetryEvent = {
  eventName: string;
  userId?: string | null;
  properties: Record<string, unknown>;
};

export async function recordServerTelemetryEvent(event: ServerTelemetryEvent): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    let userId = event.userId ?? null;

    if (!userId) {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    }

    await insertTelemetryEvent(
      {
        eventName: event.eventName,
        userId,
        properties: event.properties
      },
      supabase
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        route: "telemetry-server",
        eventName: event.eventName,
        message:
          error instanceof Error ? error.message : "Failed to persist server telemetry event"
      })
    );
  }
}
