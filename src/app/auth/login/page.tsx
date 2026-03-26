"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import AuthValueProposition from "@/components/auth/AuthValueProposition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createClientSafely,
  SUPABASE_CLIENT_UNAVAILABLE_MESSAGE
} from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useMemo(() => createClientSafely(), []);
  const isAuthUnavailable = supabase === null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!supabase) {
      setError(SUPABASE_CLIENT_UNAVAILABLE_MESSAGE);
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
    <section className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="bg-card bp-card-border rounded-xl p-6">
        <CardHeader className="border-border p-0 pb-4">
          <CardTitle className="text-2xl text-foreground">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">
            Access your saved scenarios and budget tracking.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isAuthUnavailable ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                {SUPABASE_CLIENT_UNAVAILABLE_MESSAGE}
              </div>
            ) : null}
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
                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-medium text-primary hover:text-primary/80"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            {error ? (
              <div className="bp-error flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                <p className="font-medium text-red-300">{error}</p>
              </div>
            ) : null}

            <Button
              type="submit"
              variant="default"
              disabled={isLoading || isAuthUnavailable}
              className="w-full"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/auth/signup" className="font-medium text-primary hover:text-primary/80">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
      <div className="lg:pt-1">
        <AuthValueProposition />
      </div>
    </section>
  );
}
