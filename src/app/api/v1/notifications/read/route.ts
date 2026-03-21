import { NextResponse } from "next/server";
import {
  AuthError,
  handleAuthError,
  requireAuth
} from "@/lib/supabase/auth-helpers";
import { markAllAsRead, markAsRead } from "@/lib/supabase/notifications-db";

type MarkReadBody = {
  notificationId?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    let body: MarkReadBody = {};
    try {
      body = (await request.json()) as MarkReadBody;
    } catch {
      body = {};
    }

    if (
      body.notificationId !== undefined &&
      (typeof body.notificationId !== "string" || body.notificationId.trim() === "")
    ) {
      return NextResponse.json(
        { error: "notificationId must be a non-empty string when provided" },
        { status: 400 }
      );
    }

    if (body.notificationId) {
      await markAsRead(body.notificationId);
    } else {
      await markAllAsRead(user.id);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message =
      error instanceof Error ? error.message : "Failed to update notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
