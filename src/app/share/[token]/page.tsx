"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import NewBuildResults from "@/components/NewBuildResults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSharedEstimate, type SharedEstimateSnapshot } from "@/lib/share";

const EstimateResults = dynamic(() => import("@/components/EstimateResults"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-lg bg-muted" />,
});

type ShareState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "error"; message: string }
  | { status: "ready"; snapshot: SharedEstimateSnapshot; expiresAt: string };

type SharedEstimatePageProps = {
  params: {
    token: string;
  };
};

type FetchError = Error & {
  status?: number;
};

function StatusCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function SharedEstimatePage({
  params,
}: SharedEstimatePageProps) {
  const [state, setState] = useState<ShareState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadSharedEstimate(): Promise<void> {
      try {
        const response = await getSharedEstimate(params.token);

        if (cancelled) {
          return;
        }

        setState({
          status: "ready",
          snapshot: response.estimateData,
          expiresAt: response.expiresAt,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const fetchError = error as FetchError;

        if (fetchError.status === 404) {
          setState({ status: "not_found" });
          return;
        }

        if (fetchError.status === 410) {
          setState({ status: "expired" });
          return;
        }

        setState({
          status: "error",
          message: fetchError.message ?? "Unknown error",
        });
      }
    }

    void loadSharedEstimate();

    return () => {
      cancelled = true;
    };
  }, [params.token]);

  if (state.status === "loading") {
    return <div className="space-y-4">Loading shared estimate…</div>;
  }

  if (state.status === "not_found") {
    return (
      <StatusCard title="Link not found">
        This share link is invalid or has been removed.
      </StatusCard>
    );
  }

  if (state.status === "expired") {
    return (
      <StatusCard title="Link expired">
        This share link has expired. Ask the sender to generate a new one.
      </StatusCard>
    );
  }

  if (state.status === "error") {
    return (
      <StatusCard title="Unable to load estimate">{state.message}</StatusCard>
    );
  }

  const { snapshot } = state;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          Shared estimate
        </h1>
        <p className="text-sm text-muted-foreground">Read-only link.</p>
      </div>

      {snapshot.kind === "rooms" ? (
        <EstimateResults result={snapshot.result} />
      ) : (
        <NewBuildResults result={snapshot.result} />
      )}
    </section>
  );
}
