import {
  AuthError,
  handleAuthError,
  requireAuth
} from "@/lib/supabase/auth-helpers";
import { getUnreadCount } from "@/lib/supabase/notifications-db";
import { getRequestId, jsonSuccess, jsonError, logError } from "@/lib/api-route";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await requireAuth();
    const unreadCount = await getUnreadCount(user.id);
    return jsonSuccess({ unreadCount }, requestId);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    logError("notifications/count GET", requestId, error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch unread count";
    return jsonError(message, requestId);
  }
}
