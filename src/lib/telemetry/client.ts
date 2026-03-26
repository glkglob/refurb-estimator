"use client";

export type ClientTelemetryEvent = {
  eventName: string;
  properties?: Record<string, unknown>;
};

const TELEMETRY_ENDPOINT = "/api/v1/telemetry";

export function trackTelemetryEvent(event: ClientTelemetryEvent): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload = JSON.stringify({
      eventName: event.eventName,
      properties: event.properties ?? {}
    });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(TELEMETRY_ENDPOINT, blob);
      return;
    }

    void fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: payload,
      keepalive: true
    }).catch(() => undefined);
  } catch {
    // Ignore telemetry failures so product flows are never blocked.
  }
}
