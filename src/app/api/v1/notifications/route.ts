import { type NextRequest } from "next/server";
import {
  AuthError,
  handleAuthError,
  requireAuth
} from "@/lib/supabase/auth-helpers";
import { getNotifications, getUnreadCount } from "@/lib/supabase/notifications-db";
import { paginationSchema } from "@/lib/validation";
import { getRequestId, jsonSuccess, jsonError, logError } from "@/lib/api-route";

function parseUnreadOnly(raw: string | null):
  | { ok: true; value: boolean | undefined }
  | { ok: false } {
  if (raw === null) {
    return { ok: true, value: undefined };
  }

  if (raw === "true") {
    return { ok: true, value: true };
  }

  if (raw === "false") {
    return { ok: true, value: false };
  }

  return { ok: false };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const user = await requireAuth();

    const pagination = paginationSchema.safeParse({
      page: request.nextUrl.searchParams.get("page") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    if (!pagination.success) {
      return jsonError(
        "Invalid pagination parameters",
        requestId,
        400,
        { details: pagination.error.issues.map((issue) => issue.message) }
      );
    }

    const unreadOnlyParsed = parseUnreadOnly(
      request.nextUrl.searchParams.get("unreadOnly")
    );
    if (!unreadOnlyParsed.ok) {
      return jsonError(
        "Invalid unreadOnly parameter. Use true or false.",
        requestId,
        400
      );
    }

    const [notifications, unreadCount] = await Promise.all([
      getNotifications(user.id, {
        page: pagination.data.page,
        limit: pagination.data.limit,
        unreadOnly: unreadOnlyParsed.value
      }),
      getUnreadCount(user.id)
    ]);

    return jsonSuccess(
      {
        data: notifications.data,
        total: notifications.total,
        page: pagination.data.page,
        limit: pagination.data.limit,
        unreadCount
      },
      requestId
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    logError("notifications GET", requestId, error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch notifications";
    return jsonError(message, requestId);
  }
}
