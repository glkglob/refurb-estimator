"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FEATURE_UNLOCKS = [
  "✅ Save unlimited estimates",
  "✅ Compare up to 3 renovation scenarios side-by-side",
  "✅ Track your budget vs actual spend",
  "✅ Shareable estimate links (coming soon)",
  "✅ Development appraisal tool (coming soon)"
];

export default function AuthValueProposition() {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Unlock more with a free account</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {FEATURE_UNLOCKS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
