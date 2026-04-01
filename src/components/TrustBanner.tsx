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
    <div
      style={{
        backgroundColor: "#ffffcc",
        border: "1px solid #808080",
        borderTop: "2px solid #ffffff",
        borderLeft: "2px solid #ffffff",
        borderRight: "2px solid #808080",
        borderBottom: "2px solid #808080",
        padding: "4px 8px",
        fontFamily: "Tahoma, Verdana, Arial, sans-serif",
        fontSize: "11px",
        color: "#000000",
      }}
    >
      <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
        {trustPoints.map((point) => (
          <li key={point} style={{ fontWeight: "bold" }}>
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
