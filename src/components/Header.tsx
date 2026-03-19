"use client";

import type { User } from "@supabase/supabase-js";
import { LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import HeaderAuthActions from "@/components/HeaderAuthActions";

const navItems = [
  { href: "/", label: "Quick Estimate" },
  { href: "/photo", label: "AI Estimate" },
  { href: "/rooms", label: "Detailed Rooms" },
  { href: "/scenarios", label: "Scenario Comparison" },
  { href: "/budget", label: "Budget Tracker" }
];

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), [isSupabaseConfigured]);

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
        setAuthLoading(false);
      }
    }

    void loadUser();

    const {
      data: { subscription }
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-background">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8"
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              RE
            </span>
            <span className="hidden text-sm font-semibold text-foreground sm:inline">
              Refurb Estimator
            </span>
          </Link>
          <Separator orientation="vertical" className="hidden h-5 md:block" />
          <div className="hidden items-center gap-2 md:flex">
            {navItems.map((item, index) => (
              <div key={item.href} className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className={pathname === item.href ? "font-semibold text-primary hover:text-primary" : ""}
                  asChild
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
                {index < navItems.length - 1 ? <Separator orientation="vertical" className="h-5" /> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="ml-auto hidden items-center md:flex">
          <HeaderAuthActions
            authLoading={authLoading}
            user={user}
            onSignOut={() => void handleSignOut()}
          />
        </div>

        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open navigation">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>Open a page or manage your account.</SheetDescription>
              </SheetHeader>
              <div className="mt-2 flex flex-col gap-2 p-4">
                {navItems.map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Button
                      variant="ghost"
                      className={pathname === item.href ? "justify-start font-semibold text-primary hover:text-primary" : "justify-start"}
                      asChild
                    >
                      <Link href={item.href}>{item.label}</Link>
                    </Button>
                  </SheetClose>
                ))}
                <Separator className="my-2" />
                {authLoading ? (
                  <span className="px-1 text-sm text-muted-foreground">Checking session...</span>
                ) : user ? (
                  <>
                    <span className="truncate px-1 text-sm text-muted-foreground">{user.email}</span>
                    <SheetClose asChild>
                      <Button variant="destructive" onClick={() => void handleSignOut()}>
                        <LogOut className="size-4" />
                        Sign out
                      </Button>
                    </SheetClose>
                  </>
                ) : (
                  <SheetClose asChild>
                    <Button
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary/10"
                      asChild
                    >
                      <Link href="/auth/login">Sign in</Link>
                    </Button>
                  </SheetClose>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
