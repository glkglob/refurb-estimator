import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFoundPage() {
  return (
    <section className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardContent className="space-y-4 p-8">
          <h2 className="text-lg font-semibold text-foreground">Page not found</h2>
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button variant="default" asChild>
            <Link href="/">Go to Quick Estimate</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
