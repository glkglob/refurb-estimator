"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function AuthBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return;
    }

    let isActive = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (isActive && !data.user) {
        setShow(true);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

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
