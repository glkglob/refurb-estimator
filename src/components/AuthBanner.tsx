"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Cloud } from "lucide-react";
import { createClientSafely } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    <Card className="border-accent/20 bg-accent/5">
      <CardContent className="flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
            <Cloud className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="font-medium text-foreground">Your data is saved locally</p>
            <p className="text-sm text-muted-foreground">Sign in to sync across devices and unlock more features.</p>
          </div>
        </div>
        <Button asChild className="gap-2">
          <Link href="/auth/login">
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
