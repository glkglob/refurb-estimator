"use client";

import type { User } from "@supabase/supabase-js";
import {
  Bell,
  Building2,
  Calculator,
  Camera,
  ChevronRight,
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
  Wrench
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, isApiFetchError } from "@/lib/apiClient";
import { createClient } from "@/lib/supabase/client";
import MobileBottomNav from "@/components/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const calculatorNavItems = [
  { href: "/", label: "Quick Estimate", icon: Calculator },
  { href: "/photo", label: "AI Estimate", icon: Camera },
  { href: "/ai-pricing", label: "AI Pricing", icon: Sparkles },
  { href: "/design-agent", label: "AI Design", icon: Palette },
  { href: "/new-build", label: "New Build", icon: Building2 },
  { href: "/loft", label: "Loft Conversion", icon: Calculator },
  { href: "/rooms", label: "Detailed Rooms", icon: LayoutGrid }
] as const;

const developmentNavItems = [
  { href: "/development", label: "Development Appraisal", icon: Building2 },
  { href: "/tradespeople", label: "Tradespeople", icon: Wrench }
] as const;

const planningNavItems = [
  { href: "/scenarios", label: "Scenario Comparison", icon: GitCompare },
  { href: "/budget", label: "Budget Tracker", icon: Wallet }
] as const;

const dashboardItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/profile", label: "My Profile", icon: UserCircle },
  { href: "/dashboard/gallery", label: "My Gallery", icon: Images }
] as const;

function isPathActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavSection({
  title,
  items,
  pathname,
  onNavigate,
  requiresAuth = false,
  user
}: {
  title: string;
  items: readonly { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  pathname: string;
  onNavigate?: () => void;
  requiresAuth?: boolean;
  user?: User | null;
}) {
  if (requiresAuth && !user) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = isPathActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground/80 hover:bg-muted hover:text-foreground"
              }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="font-medium">{item.label}</span>
            {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
          </Link>
        );
      })}
    </div>
  );
}

function SidebarContent({
  pathname,
  authLoading,
  user,
  unreadCount,
  onSignOut,
  onNavigate
}: {
  pathname: string;
  authLoading: boolean;
  user: User | null;
  unreadCount: number;
  onSignOut: () => Promise<void>;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <span className="font-serif text-lg font-medium tracking-tight">Refurb</span>
            <span className="text-xs text-muted-foreground ml-1">Estimator</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6">
        <NavSection
          title="Calculators"
          items={calculatorNavItems}
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <NavSection
          title="Development"
          items={developmentNavItems}
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <NavSection
          title="Planning"
          items={planningNavItems}
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <NavSection
          title="Account"
          items={dashboardItems}
          pathname={pathname}
          onNavigate={onNavigate}
          requiresAuth
          user={user}
        />
      </nav>

      {/* User Section */}
      <div className="border-t border-border p-4">
        {authLoading ? (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        ) : user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium">{user.email}</p>
              </div>
            </div>
            <div className="space-y-1">
              <Link
                href="/dashboard/notifications"
                onClick={onNavigate}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
              >
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <button
                onClick={() => void onSignOut()}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        ) : (
          <Link
            href="/auth/login"
            onClick={onNavigate}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign in
          </Link>
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
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card md:flex">
        <SidebarContent
          pathname={pathname}
          authLoading={authLoading}
          user={user}
          unreadCount={displayedUnreadCount}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Mobile Header */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="font-serif text-lg font-medium">Refurb</span>
        </Link>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SidebarContent
              pathname={pathname}
              authLoading={authLoading}
              user={user}
              unreadCount={displayedUnreadCount}
              onSignOut={handleSignOut}
              onNavigate={handleNavigate}
            />
          </SheetContent>
        </Sheet>
      </div>

      <MobileBottomNav pathname={pathname} isOpen={isOpen} onOpenChange={setIsOpen}>
        <SidebarContent
          pathname={pathname}
          authLoading={authLoading}
          user={user}
          unreadCount={displayedUnreadCount}
          onSignOut={handleSignOut}
          onNavigate={handleNavigate}
        />
      </MobileBottomNav>

      {/* Mobile spacer */}
      <div className="h-28 md:hidden" />
    </>
  );
}
