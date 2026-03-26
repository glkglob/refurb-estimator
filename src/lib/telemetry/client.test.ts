/** @jest-environment jsdom */

import { trackTelemetryEvent } from "@/lib/telemetry/client";

describe("trackTelemetryEvent", () => {
  let originalFetch: typeof fetch;
  let originalSendBeacon: Navigator["sendBeacon"] | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalSendBeacon = navigator.sendBeacon;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      writable: true,
      value: originalSendBeacon
    });
    jest.clearAllMocks();
  });

  test("uses sendBeacon when available", () => {
    const sendBeacon = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      writable: true,
      value: sendBeacon
    });
    global.fetch = jest.fn();

    trackTelemetryEvent({
      eventName: "assistant.ui.outcome",
      properties: { mode: "new_build" }
    });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon).toHaveBeenCalledWith("/api/v1/telemetry", expect.any(Blob));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("falls back to fetch when sendBeacon is unavailable", async () => {
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      writable: true,
      value: undefined
    });
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    trackTelemetryEvent({
      eventName: "assistant.ui.outcome",
      properties: { outcome: "applied" }
    });

    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/telemetry",
      expect.objectContaining({
        method: "POST",
        keepalive: true
      })
    );
  });
});
