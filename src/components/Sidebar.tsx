"use client";

import type { User } from "@supabase/supabase-js";
import {
  Bell,
  Building2,
  Calculator,
  Camera,
  GitCompare,
  Images,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Palette,
  Sparkles,
  UserCircle,
  Wallet,
  X
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, isApiFetchError } from "@/lib/apiClient";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Quick Estimate", icon: "Calculator" },
  { href: "/photo", label: "AI Estimate", icon: "Camera" },
  { href: "/ai-pricing", label: "AI Pricing", icon: "Sparkles" },
  { href: "/design-agent", label: "AI Design", icon: "Palette" },
  { href: "/new-build", label: "New Build", icon: "Building2" },
  { href: "/rooms", label: "Detailed Rooms", icon: "LayoutGrid" },
  { href: "/scenarios", label: "Scenario Comparison", icon: "GitCompare" },
  { href: "/budget", label: "Budget Tracker", icon: "Wallet" }
] as const;

const dashboardItems = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/dashboard/profile", label: "My Profile", icon: "UserCircle" },
  { href: "/dashboard/gallery", label: "My Gallery", icon: "Images" }
] as const;

const iconMap = {
  Calculator,
  Camera,
  Building2,
  LayoutGrid,
  GitCompare,
  Wallet,
  LayoutDashboard,
  UserCircle,
  Images,
  Sparkles,
  Palette
};

function SidebarContent({
  pathname,
  authLoading,
  user,
  unreadCount,
  onSignOut,
  onNavigate,
  useSheetClose = false
}: {
  pathname: string;
  authLoading: boolean;
  user: User | null;
  unreadCount: number;
  onSignOut: () => Promise<void>;
  onNavigate?: () => void;
  useSheetClose?: boolean;
}) {
  function renderNavLink(
    item: { href: string; label: string; icon: keyof typeof iconMap },
    requiresAuth = false
  ) {
    if (requiresAuth && !user) {
      return null;
    }

    const Icon = iconMap[item.icon];
    const isActive = pathname === item.href;
    const linkClassName = isActive
      ? "flex items-center gap-2 rounded-r-md border-l-4 border-[var(--primary)] bg-sidebar-accent px-3 py-2 text-sm font-medium text-sidebar-primary"
      : "flex items-center gap-2 rounded-r-md border-l-4 border-l-transparent px-3 py-2 text-sm text-sidebar-foreground hover:bg-[#1A2533] hover:text-[var(--primary)]";
    const linkNode = (
      <Link key={item.href} href={item.href} onClick={onNavigate} className={linkClassName}>
        <Icon className="size-4" />
        <span>{item.label}</span>
      </Link>
    );

    if (useSheetClose) {
      return (
        <SheetClose asChild key={item.href}>
          {linkNode}
        </SheetClose>
      );
    }

    return linkNode;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <Link href="/" onClick={onNavigate} className="inline-flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            RE
          </span>
          <span className="font-mono text-sm font-semibold text-sidebar-foreground">
            Refurb Estimator
          </span>
        </Link>
      </div>

      <nav className="flex flex-col gap-1 px-2 py-4">
        {navItems.map((item) => renderNavLink(item))}
        {user ? <div className="mx-3 my-2 border-t border-[var(--border)]" /> : null}
        {dashboardItems.map((item) => renderNavLink(item, true))}
      </nav>

      <div className="mt-auto border-t border-[var(--border)] px-3 py-4">
        {authLoading ? (
          <p className="text-sm text-muted-foreground">Checking session...</p>
        ) : user ? (
          <div className="space-y-2">
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <div className="space-y-2">
              {useSheetClose ? (
                <SheetClose asChild>
                  <Button
                    variant="outline"
                    className="relative w-full justify-start border-[var(--border)] text-primary hover:bg-primary/10"
                    asChild
                  >
                    <Link href="/dashboard/notifications" onClick={onNavigate}>
                      <Bell className="size-4" />
                      Notifications
                      {unreadCount > 0 ? (
                        <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-destructive" />
                      ) : null}
                    </Link>
                  </Button>
                </SheetClose>
              ) : (
                <Button
                  variant="outline"
                  className="relative w-full justify-start border-[var(--border)] text-primary hover:bg-primary/10"
                  asChild
                >
                  <Link href="/dashboard/notifications" onClick={onNavigate}>
                    <Bell className="size-4" />
                    Notifications
                    {unreadCount > 0 ? (
                      <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-destructive" />
                    ) : null}
                  </Link>
                </Button>
              )}
              <Button
                variant="destructive"
                className="w-full justify-start"
                onClick={() => void onSignOut()}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </div>
        ) : (
          useSheetClose ? (
            <SheetClose asChild>
              <Button
                variant="outline"
                className="w-full justify-start border-[var(--border)] text-primary hover:bg-primary/10"
                asChild
              >
                <Link href="/auth/login" onClick={onNavigate}>
                  Sign in
                </Link>
              </Button>
            </SheetClose>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start border-[var(--border)] text-primary hover:bg-primary/10"
              asChild
            >
              <Link href="/auth/login" onClick={onNavigate}>
                Sign in
              </Link>
            </Button>
          )
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [user, setUser] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(
    () => (isSupabaseConfigured ? createClient() : null),
    [isSupabaseConfigured]
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }
    const supabaseClient = supabase;
    let isActive = true;

    async function loadUser() {
      const {
        data: { user: currentUser }
      } = await supabaseClient.auth.getUser();

      if (isActive) {
        setUser(currentUser);
        setUnreadCount(0);
        setAuthLoading(false);
      }
    }

    void loadUser();

    const {
      data: { subscription }
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setUnreadCount(0);
      }
      setAuthLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let isActive = true;

    async function fetchUnreadCount() {
      try {
        const response = await apiFetch("/api/v1/notifications/count");
        const payload = (await response.json()) as { unreadCount?: number };
        if (isActive) {
          setUnreadCount(typeof payload.unreadCount === "number" ? payload.unreadCount : 0);
        }
      } catch (error) {
        if (isApiFetchError(error) && error.status === 401) {
          if (isActive) {
            setUnreadCount(0);
          }
          return;
        }
        if (isActive) {
          setUnreadCount(0);
        }
      }
    }

    void fetchUnreadCount();

    return () => {
      isActive = false;
    };
  }, [user]);

  const displayedUnreadCount = user ? unreadCount : 0;

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    setUnreadCount(0);
    setIsOpen(false);
    router.push("/");
    router.refresh();
  }

  function handleNavigate() {
    setIsOpen(false);
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[240px] border-r border-[var(--border)] bg-[#0A1420] md:block">
        <SidebarContent
          pathname={pathname}
          authLoading={authLoading}
          user={user}
          unreadCount={displayedUnreadCount}
          onSignOut={handleSignOut}
        />
      </aside>

      <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[#0A1420] px-4 md:hidden">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            RE
          </span>
          <span className="font-mono text-sm font-semibold text-sidebar-foreground">
            Refurb Estimator
          </span>
        </Link>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open sidebar navigation">
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[85vw] max-w-[240px] border-r border-[var(--border)] bg-[#0A1420] p-0"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-4">
              <span className="font-mono text-sm font-semibold text-sidebar-foreground">
                Refurb Estimator
              </span>
              <SheetClose asChild>
                <Button variant="ghost" size="icon" aria-label="Close sidebar navigation">
                  <X className="size-4" />
                </Button>
              </SheetClose>
            </div>
            <SidebarContent
              pathname={pathname}
              authLoading={authLoading}
              user={user}
              unreadCount={displayedUnreadCount}
              onSignOut={handleSignOut}
              onNavigate={handleNavigate}
              useSheetClose
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
