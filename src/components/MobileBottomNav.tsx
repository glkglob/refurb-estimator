"use client";

import {
  Building2,
  Calculator,
  Camera,
  GitCompare,
  Menu,
  type LucideIcon,
  Wrench
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
  { href: "/", label: "Quick Estimate", icon: Calculator },
  { href: "/photo", label: "AI Estimate", icon: Camera },
  { href: "/development", label: "Dev Appraisal", icon: Building2 },
  { href: "/scenarios", label: "Scenarios", icon: GitCompare },
  { href: "/tradespeople", label: "Tradespeople", icon: Wrench }
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
    <div className="fixed bottom-0 left-0 right-0 z-50 flex overflow-x-hidden border-t border-[var(--border)] bg-[#0A1420]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <nav aria-label="Mobile bottom navigation" className="flex min-h-16 min-w-0 flex-1 items-stretch">
        {mobilePrimaryNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isPathActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex min-h-16 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 px-1 text-center text-[0.6875rem] leading-tight transition-[background-color,color,transform] duration-200 ease-out motion-reduce:transition-none active:scale-[0.98] active:-translate-y-px focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1420]",
                isActive
                  ? "bg-primary/15 font-semibold text-white"
                  : "text-slate-300/90 hover:bg-white/5 hover:text-white"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-x-3 top-1 h-0.5 rounded-full transition-opacity duration-150",
                  isActive ? "bg-white opacity-100" : "opacity-0"
                )}
              />
              <Icon className="size-[18px]" />
              <span className="max-w-full whitespace-normal">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <Sheet open={isOpen} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "min-h-16 min-w-0 shrink basis-0 whitespace-normal rounded-none px-1 text-slate-300/90 transition-[background-color,color,transform] duration-200 ease-out motion-reduce:transition-none active:scale-[0.98] active:-translate-y-px hover:bg-white/5 hover:text-white focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A1420]",
              isOpen ? "bg-primary/15 text-white" : undefined
            )}
            aria-label="Open more navigation options"
            aria-expanded={isOpen}
          >
            <span className="flex max-w-full flex-col items-center justify-center gap-1 text-[0.6875rem] leading-tight">
              <Menu className="size-4" />
              <span className="whitespace-normal">More</span>
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] rounded-t-xl border-t border-[var(--border)] bg-[#0A1420] p-0"
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
