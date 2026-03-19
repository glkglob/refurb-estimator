"use client";

import type { User } from "@supabase/supabase-js";
import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

type HeaderAuthActionsProps = {
  authLoading: boolean;
  user: User | null;
  onSignOut: () => void;
};

export default function HeaderAuthActions({ authLoading, user, onSignOut }: HeaderAuthActionsProps) {
  if (authLoading) {
    return <span className="text-xs text-muted-foreground">Checking session...</span>;
  }

  if (!user) {
    return (
      <Button variant="outline" className="border-primary text-primary hover:bg-primary/10" asChild>
        <Link href="/auth/login">Sign in</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="max-w-44 justify-between gap-2">
          <span className="truncate">{user.email}</span>
          <UserRound className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(event) => {
            event.preventDefault();
            onSignOut();
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
