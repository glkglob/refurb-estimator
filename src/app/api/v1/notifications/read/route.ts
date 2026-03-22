import { z } from "zod";
import {
  AuthError,
  handleAuthError,
  requireAuth
} from "@/lib/supabase/auth-helpers";
import { markAllAsRead, markAsRead } from "@/lib/supabase/notifications-db";
import { validateWithSchema } from "@/lib/validate";
import { getRequestId, jsonSuccess, jsonError, logError } from "@/lib/api-route";

const markReadSchema = z.object({
  notificationId: z.string().trim().min(1).optional()
});

type MarkReadBody = z.infer<typeof markReadSchema>;

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

    return jsonSuccess({ success: true }, requestId);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    logError("notifications/read POST", requestId, error);
    const message =
      error instanceof Error ? error.message : "Failed to update notifications";
    return jsonError(message, requestId);
  }
}
