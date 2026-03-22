import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

/**
 * Extract or generate a request ID from the incoming request headers.
 */
export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") ?? randomUUID();
}

/**
 * Return a successful JSON response with the x-request-id header.
 */
export function jsonSuccess<T>(data: T, requestId: string, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "x-request-id": requestId }
  });
}

/**
 * Return an error JSON response with the x-request-id header.
 */
export function jsonError(
  error: string,
  requestId: string,
  status = 500,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    { error, ...extra },
    { status, headers: { "x-request-id": requestId } }
  );
}

/**
 * Structured error logging with request context.
 */
export function logError(
  route: string,
  requestId: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(JSON.stringify({
    level: "error",
    route,
    requestId,
    message,
    ...(stack ? { stack } : {}),
    ...context
  }));
}
