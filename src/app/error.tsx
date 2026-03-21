"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <section className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardContent className="space-y-4 p-8">
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
          <Button variant="default" onClick={reset}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
