"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AuthGateProps = {
  children: ReactNode;
  preview?: ReactNode;
  proLabel?: string;
};

type AuthState = "checking" | "authenticated" | "unauthenticated";

export default function AuthGate({
  children,
  preview,
  proLabel = "Pro feature — free during beta"
}: AuthGateProps) {
  const isSupabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const [authState, setAuthState] = useState<AuthState>(
    isSupabaseConfigured ? "checking" : "authenticated"
  );

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let isActive = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (!isActive) {
        return;
      }

      setAuthState(data.user ? "authenticated" : "unauthenticated");
    });

    return () => {
      isActive = false;
    };
  }, [isSupabaseConfigured]);

  if (authState === "authenticated") {
    return <>{children}</>;
  }

  return (
    <section className="space-y-4">
      {preview ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{proLabel}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{preview}</CardContent>
        </Card>
      ) : null}

      <div className="relative overflow-hidden rounded-xl border">
        <div className="pointer-events-none select-none blur-[6px] opacity-50">
          {children}
        </div>

        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-primary/30 bg-card/95 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="size-4 text-primary" />
                {proLabel}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Sign in to unlock full development appraisal numbers, detailed
                profitability outputs, and BRRR refinance calculations.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link href="/auth/login">Sign in to unlock</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/auth/signup">Create account</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
