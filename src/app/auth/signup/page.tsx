"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setIsLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setMessage("Check your email to confirm your account");
  }

  return (
    <section className="mx-auto w-full max-w-md">
      <Card className="bg-card bp-card-border rounded-xl p-6">
        <CardHeader className="border-border p-0 pb-4">
          <CardTitle className="text-2xl text-foreground">Create account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign up to sync scenarios and budget tracking.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-foreground">
                Confirm password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
              />
            </div>

            {error ? (
              <div className="bp-error flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                <p className="font-medium text-red-300">{error}</p>
              </div>
            ) : null}
            {message ? <p className="text-sm text-primary">{message}</p> : null}

            <Button type="submit" variant="default" disabled={isLoading} className="w-full">
              {isLoading ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-medium text-primary hover:text-primary/80">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
