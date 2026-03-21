import { NextResponse } from "next/server";
import {
  AuthError,
  handleAuthError,
  requireAuth
} from "@/lib/supabase/auth-helpers";
import { getUnreadCount } from "@/lib/supabase/notifications-db";

export async function GET() {
  try {
    const user = await requireAuth();
    const unreadCount = await getUnreadCount(user.id);
    return NextResponse.json({ unreadCount }, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message =
      error instanceof Error ? error.message : "Failed to fetch unread count";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
