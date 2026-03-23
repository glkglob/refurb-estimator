import { NextResponse, type NextRequest } from "next/server";
import {
  getRequestId,
  jsonError,
  jsonSuccess,
  logError
} from "@/lib/api-route";
import {
  AuthError,
  handleAuthError,
  requireAuth
} from "@/lib/supabase/auth-helpers";
import { getNotifications, getUnreadCount } from "@/lib/supabase/notifications-db";
import { paginationSchema } from "@/lib/validation";

const ROUTE_TAG = "api/v1/notifications";

function parseUnreadOnly(raw: string | null):
  | { ok: true; value: boolean | undefined }
  | { ok: false; response: NextResponse } {
  if (raw === null) {
    return { ok: true, value: undefined };
  }

  if (raw === "true") {
    return { ok: true, value: true };
  }

  if (raw === "false") {
    return { ok: true, value: false };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { error: "Invalid unreadOnly parameter. Use true or false." },
      { status: 400 }
    )
  };
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
      return jsonError({
        status: 400,
        error: "Invalid pagination parameters",
        details: pagination.error.issues.map((issue) => issue.message),
        requestId,
        code: "INVALID_PAGINATION"
      });
    }

    const unreadOnlyParsed = parseUnreadOnly(
      request.nextUrl.searchParams.get("unreadOnly")
    );
    if (!unreadOnlyParsed.ok) {
      return unreadOnlyParsed.response;
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
      { status: 200, requestId }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message =
      error instanceof Error ? error.message : "Failed to fetch notifications";
    logError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "NOTIFICATIONS_GET_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "NOTIFICATIONS_GET_FAILED"
    });
  }
}
