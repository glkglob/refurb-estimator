"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClientSafely } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function AuthBanner() {
  const [show, setShow] = useState(false);
  const supabase = useMemo(() => createClientSafely(), []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isActive = true;

    async function loadAuthState() {
      const result = await supabase.auth.getUser();
      if (isActive && !result.data.user) {
        setShow(true);
      }
    }

    void loadAuthState();

    return () => {
      isActive = false;
    };
  }, [supabase]);

  if (!show) {
    return null;
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
      <span>Your data is saved locally. </span>
      <Button variant="link" className="h-auto p-0 text-sm font-medium text-primary" asChild>
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <span> to sync across devices.</span>
    </div>
  );
}
