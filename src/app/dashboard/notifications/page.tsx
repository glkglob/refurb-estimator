"use client";

import { Bell, FileText, Loader2, MessageSquare, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, isApiFetchError } from "@/lib/apiClient";
import { relativeTime } from "@/lib/relative-time";
import type { Notification, NotificationType } from "@/lib/platform-types";

const PAGE_SIZE = 20;

type NotificationsResponse = {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  unreadCount: number;
};

function getNotificationIcon(type: NotificationType) {
  if (type === "message") {
    return MessageSquare;
  }
  if (type === "estimate_request") {
    return FileText;
  }
  if (type === "review") {
    return Star;
  }
  return Bell;
}

export default function DashboardNotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMore = useMemo(
    () => notifications.length < total,
    [notifications.length, total]
  );

  async function loadNotifications(targetPage: number, append: boolean) {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setError(null);
    }

    try {
      const response = await apiFetch(
        `/api/v1/notifications?page=${targetPage}&limit=${PAGE_SIZE}`
      );
      const parsed = (await response.json()) as NotificationsResponse;
      const nextData = Array.isArray(parsed.data) ? parsed.data : [];
      setNotifications((previous) => (append ? [...previous, ...nextData] : nextData));
      setTotal(typeof parsed.total === "number" ? parsed.total : 0);
      setUnreadCount(typeof parsed.unreadCount === "number" ? parsed.unreadCount : 0);
      setPage(targetPage);
    } catch (loadError) {
      if (isApiFetchError(loadError) && loadError.status === 401) {
        router.replace("/auth/login");
        return;
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load notifications."
      );
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadNotifications(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

async function markNotificationAsRead(notificationId: string) {
    try {
      await apiFetch("/api/v1/notifications/read", {
        method: "POST",
        body: JSON.stringify({ notificationId })
      });
      return true;
    } catch (error) {
      if (isApiFetchError(error) && error.status === 401) {
        router.replace("/auth/login");
        return false;
      }

      throw error;
    }
  }

  async function handleNotificationClick(notification: Notification) {
    try {
      if (!notification.isRead) {
        const updated = await markNotificationAsRead(notification.id);
        if (!updated) {
          return;
        }

        setNotifications((previous) =>
          previous.map((item) =>
            item.id === notification.id ? { ...item, isRead: true } : item
          )
        );
        setUnreadCount((previous) => Math.max(0, previous - 1));
      }

      if (notification.link) {
        router.push(notification.link);
      }
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to open notification."
      );
    }
  }

  async function handleMarkAllAsRead() {
    setIsMarkingAll(true);
    setError(null);

    try {
      await apiFetch("/api/v1/notifications/read", {
        method: "POST",
        body: "{}"
      });

      setNotifications((previous) =>
        previous.map((notification) => ({ ...notification, isRead: true }))
      );
      setUnreadCount(0);
    } catch (actionError) {
      if (isApiFetchError(actionError) && actionError.status === 401) {
        router.replace("/auth/login");
        return;
      }

      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to update notifications."
      );
    } finally {
      setIsMarkingAll(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Keep track of estimate requests, messages, and platform updates.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleMarkAllAsRead()}
          disabled={isMarkingAll || unreadCount === 0}
        >
          {isMarkingAll ? <Loader2 className="size-4 animate-spin" /> : null}
          Mark all as read
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Inbox
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
              {unreadCount} unread
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="rounded-lg border border-border bg-card p-4">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Bell className="size-8 text-muted-foreground" />
              <p className="text-base font-medium text-foreground">No notifications yet</p>
              <p className="text-sm text-muted-foreground">
                You&apos;ll see estimate requests and updates here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const isUnread = !notification.isRead;

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void handleNotificationClick(notification)}
                    className={`relative w-full rounded-lg border p-4 text-left transition-colors ${
                      isUnread
                        ? "border-l-2 border-l-primary bg-card"
                        : "border-border bg-background"
                    }`}
                  >
                    {isUnread ? (
                      <span className="absolute left-2 top-2 h-2 w-2 rounded-full bg-primary" />
                    ) : null}
                    <div className="flex items-start gap-3">
                      <Icon
                        className={`mt-0.5 size-4 ${
                          isUnread ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">{notification.title}</p>
                          <span className="text-xs text-muted-foreground">
                            {relativeTime(notification.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.body}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {hasMore ? (
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadNotifications(page + 1, true)}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                Load more
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
