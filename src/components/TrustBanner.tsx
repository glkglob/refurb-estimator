"use client";

import { Home, Sparkles, MapPin, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const FALLBACK_ESTIMATE_COUNT = 12_000;

function formatEstimateCount(count: number): string {
  return `${new Intl.NumberFormat("en-GB").format(count)}+`;
}

export default function TrustBanner() {
  const [estimateCount, setEstimateCount] = useState(FALLBACK_ESTIMATE_COUNT);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return;
    }

    let isActive = true;

    async function loadEstimateCount(): Promise<void> {
      try {
        const supabase = createClient();
        const { count, error } = await supabase
          .from("estimates")
          .select("*", { count: "exact", head: true });

        if (!isActive || error || typeof count !== "number") {
          return;
        }

        setEstimateCount(Math.max(count, FALLBACK_ESTIMATE_COUNT));
      } catch {
        // Intentionally swallow errors and keep marketing fallback count.
      }
    }

    void loadEstimateCount();

    return () => {
      isActive = false;
    };
  }, []);

  const trustPoints = useMemo(
    () => [
      { icon: Home, text: `${formatEstimateCount(estimateCount)} estimates generated` },
      { icon: Sparkles, text: "AI-powered" },
      { icon: MapPin, text: "UK regional pricing" },
      { icon: Shield, text: "No login required" },
    ],
    [estimateCount],
  );

  return (
    <ul className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
      {trustPoints.map((point) => {
        const Icon = point.icon;
        return (
          <li key={point.text} className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon className="h-4 w-4 text-accent" />
            <span className="font-medium">{point.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
