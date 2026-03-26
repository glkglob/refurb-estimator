import { createServerSupabaseClient } from "@/lib/supabase/server";

export type TelemetryEventInsert = {
  eventName: string;
  userId?: string | null;
  properties?: Record<string, unknown>;
};

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export async function insertTelemetryEvent(
  event: TelemetryEventInsert,
  supabaseClient?: ServerSupabaseClient
): Promise<void> {
  const supabase = supabaseClient ?? (await createServerSupabaseClient());
  const { error } = await supabase.from("telemetry_events").insert({
    event_name: event.eventName,
    user_id: event.userId ?? null,
    properties: event.properties ?? {}
  });

  if (error) {
    throw new Error(`Failed to insert telemetry event: ${error.message}`);
  }
}
