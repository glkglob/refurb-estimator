import {
  getRequestId,
  jsonError,
  jsonSuccess,
  logApiError,
  withRequestIdHeader
} from "@/lib/api-route";
import {
  AuthError,
  handleAuthError,
  requireAuth
} from "@/lib/supabase/auth-helpers";
import { getUnreadCount } from "@/lib/supabase/notifications-db";

const ROUTE_TAG = "api/v1/notifications/count";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await requireAuth();
    const unreadCount = await getUnreadCount(user.id);
    return jsonSuccess({ unreadCount }, { status: 200, requestId });
  } catch (error) {
    if (error instanceof AuthError) {
      return withRequestIdHeader(handleAuthError(error), requestId);
    }

    const message =
      error instanceof Error ? error.message : "Failed to fetch unread count";
    logApiError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "NOTIFICATIONS_COUNT_GET_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "NOTIFICATIONS_COUNT_GET_FAILED"
    });
  }
}
