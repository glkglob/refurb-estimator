"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!supabase) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setIsLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/login`
    });
    setIsLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setMessage("If an account exists for this email, a reset link has been sent.");
  }

  return (
    <section className="mx-auto w-full max-w-md">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your email to receive a password reset link.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {message ? <p className="text-sm text-green-600">{message}</p> : null}

            <Button type="submit" variant="default" disabled={isLoading} className="w-full">
              {isLoading ? "Sending reset link..." : "Send reset link"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            Back to{" "}
            <Link href="/auth/login" className="font-medium text-foreground underline">
              Sign in
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
