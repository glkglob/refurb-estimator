"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import NewBuildResults from "@/components/NewBuildResults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSharedEstimate, type SharedEstimateSnapshot } from "@/lib/share";

const EstimateResults = dynamic(() => import("@/components/EstimateResults"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-lg bg-muted" />
});

type ShareState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: SharedEstimateSnapshot; expiresAt: string };

export default function SharedEstimatePage({ params }: { params: { token: string } }) {
  const [state, setState] = useState<ShareState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await getSharedEstimate(params.token);
        if (cancelled) return;
        setState({ status: "ready", snapshot: res.estimateData, expiresAt: res.expiresAt });
      } catch (err) {
        if (cancelled) return;
        const e = err as Error & { status?: number };
        if (e.status === 404) setState({ status: "not_found" });
        else if (e.status === 410) setState({ status: "expired" });
        else setState({ status: "error", message: e.message ?? "Unknown error" });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  if (state.status === "loading") {
    return <div className="space-y-4">Loading shared estimate…</div>;
  }

  if (state.status === "not_found") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link not found</CardTitle>
        </CardHeader>
        <CardContent>This share link is invalid or has been removed.</CardContent>
      </Card>
    );
  }

  if (state.status === "expired") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link expired</CardTitle>
        </CardHeader>
        <CardContent>This share link has expired. Ask the sender to generate a new one.</CardContent>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Unable to load estimate</CardTitle>
        </CardHeader>
        <CardContent>{state.message}</CardContent>
      </Card>
    );
  }

  const { snapshot } = state;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Shared estimate</h1>
        <p className="text-sm text-muted-foreground">Read-only link.</p>
      </div>

      {snapshot.kind === "rooms" ? (
        <EstimateResults result={snapshot.result as any} />
      ) : (
        <NewBuildResults result={snapshot.result as any} />
      )}
    </section>
  );
}
