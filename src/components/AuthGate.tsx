"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { createClientSafely } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AuthGateProps = {
  children: ReactNode;
  featureName: string;
  featureDescription: string;
};

type AuthState = "checking" | "authenticated" | "unauthenticated";

export default function AuthGate({
  children,
  featureName,
  featureDescription
}: AuthGateProps) {
  const supabase = useMemo(() => createClientSafely(), []);
  const [authState, setAuthState] = useState<AuthState>(
    supabase ? "checking" : "authenticated"
  );

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isActive = true;

    async function loadAuthState() {
      const result = await supabase.auth.getUser();
      if (!isActive) {
        return;
      }

      setAuthState(result.data.user ? "authenticated" : "unauthenticated");
    }

    void loadAuthState();

    return () => {
      isActive = false;
    };
  }, [supabase]);

  if (authState === "authenticated") {
    return <>{children}</>;
  }

  return (
    <div className="relative overflow-hidden rounded-xl border">
      <div className="blur-sm pointer-events-none select-none overflow-hidden opacity-55">
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-primary/30 bg-card/95 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="size-4 text-primary" />
              {featureName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{featureDescription}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/auth/signin">Sign in to unlock</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/auth/signup">Create free account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
