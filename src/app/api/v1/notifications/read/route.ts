import { z } from "zod";
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
import { markAllAsRead, markAsRead } from "@/lib/supabase/notifications-db";
import { validateWithSchema } from "@/lib/validate";

const markReadSchema = z.object({
  notificationId: z.string().trim().min(1).optional()
});

type MarkReadBody = z.infer<typeof markReadSchema>;
const ROUTE_TAG = "api/v1/notifications/read";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await requireAuth();

    let body: MarkReadBody = {};
    try {
      body = (await request.json()) as MarkReadBody;
    } catch {
      body = {};
    }

    const parsedBody = validateWithSchema(markReadSchema, body, {
      errorMessage: "Invalid notifications read payload"
    });
    if (!parsedBody.success) {
      return parsedBody.response;
    }
    const validatedBody: MarkReadBody = parsedBody.data;

    if (validatedBody.notificationId) {
      await markAsRead(validatedBody.notificationId);
    } else {
      await markAllAsRead(user.id);
    }

    return jsonSuccess({ success: true }, { status: 200, requestId });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message =
      error instanceof Error ? error.message : "Failed to update notifications";
    logError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "NOTIFICATIONS_READ_POST_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "NOTIFICATIONS_READ_POST_FAILED"
    });
  }
}
