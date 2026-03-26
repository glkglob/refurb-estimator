"use client";

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
      `🏠 ${formatEstimateCount(estimateCount)} estimates generated`,
      "⭐ AI-powered",
      "🗺️ UK regional pricing",
      "🔒 No login required",
    ],
    [estimateCount],
  );

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <ul className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2 sm:text-sm">
        {trustPoints.map((point) => (
          <li key={point} className="font-medium">
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
