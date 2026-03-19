"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useMemo(() => (isSupabaseConfigured ? createClient() : null), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!supabase) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }

    setIsLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    const redirectedFrom =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("redirectedFrom")
        : null;
    router.push(redirectedFrom || "/scenarios");
    router.refresh();
  }

  return (
    <section className="mx-auto w-full max-w-md">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">
            Access your saved scenarios and budget tracking.
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

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Your password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              <div className="text-right">
                <Link href="/auth/forgot-password" className="text-xs font-medium text-primary underline">
                  Forgot password?
                </Link>
              </div>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button type="submit" variant="default" disabled={isLoading} className="w-full">
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/auth/signup" className="font-medium text-foreground underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
