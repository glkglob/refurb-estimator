import type { Notification, NotificationType } from "../platform-types";
import { createClient } from "./client";
import { createServerSupabaseClient } from "./server";

type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    isRead: row.is_read,
    createdAt: row.created_at
  };
}

export async function getNotifications(
  userId: string,
  options: { page: number; limit: number; unreadOnly?: boolean }
): Promise<{ data: Notification[]; total: number }> {
  const supabase = createClient();
  const start = (options.page - 1) * options.limit;
  const end = start + options.limit - 1;

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options.unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error, count } = await query.range(start, end);

  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }

  return {
    data: (data ?? []).map((row) => mapNotificationRow(row as NotificationRow)),
    total: count ?? 0
  };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new Error(`Failed to fetch unread notification count: ${error.message}`);
  }

  return count ?? 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
}

export async function markAllAsRead(userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    throw new Error(`Failed to mark all notifications as read: ${error.message}`);
  }
}

// Server-only: uses cookies
export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}): Promise<Notification> {
  const supabase = await createServerSupabaseClient();
  const payload = {
    user_id: data.userId,
    type: data.type,
    title: data.title,
    body: data.body,
    link: data.link ?? null
  };

  const { data: created, error } = await supabase
    .from("notifications")
    .insert(payload)
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create notification: ${error?.message ?? "Unknown error"}`);
  }

  return mapNotificationRow(created as NotificationRow);
}
