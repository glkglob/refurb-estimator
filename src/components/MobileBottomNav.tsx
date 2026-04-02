"use client";

import {
  Building2,
  Calculator,
  Camera,
  GitCompare,
  Menu,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { VisuallyHidden } from "radix-ui";

type MobileNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type MobileBottomNavProps = {
  pathname: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children: ReactNode;
};

const mobilePrimaryNavItems: readonly MobileNavItem[] = [
  { href: "/",            label: "Estimate",    icon: Calculator },
  { href: "/photo",       label: "AI Photo",    icon: Camera },
  { href: "/development", label: "Development", icon: Building2 },
  { href: "/scenarios",   label: "Scenarios",   icon: GitCompare },
] as const;

function isPathActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileBottomNav({
  pathname,
  isOpen,
  onOpenChange,
  children
}: MobileBottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex overflow-x-hidden border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
      <nav aria-label="Mobile bottom navigation" className="flex min-h-14 min-w-0 flex-1 items-stretch">
        {mobilePrimaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isPathActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 px-1 text-center text-xs leading-tight transition-all duration-200 ease-out active:scale-95",
                isActive
                  ? "bg-primary/15 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent"
                />
              )}
              <Icon className="h-5 w-5" />
              <span className="max-w-full font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "min-h-14 min-w-0 shrink basis-0 rounded-none px-3 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground",
              isOpen ? "text-accent" : undefined
            )}
            aria-label="Open more navigation options"
            aria-expanded={isOpen}
          >
            <span className="flex flex-col items-center justify-center gap-1 text-xs font-medium leading-tight">
              <Menu className="h-5 w-5" />
              <span>More</span>
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] rounded-t-2xl border-t border-border bg-card p-0"
        >
          <VisuallyHidden.Root>
            <SheetTitle>Navigation menu</SheetTitle>
            <SheetDescription>Site navigation and user account options</SheetDescription>
          </VisuallyHidden.Root>
          <div className="max-h-[85vh] overflow-y-auto">{children}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
