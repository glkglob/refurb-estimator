export type SharedEstimateSnapshot =
  | {
      kind: "rooms";
      input: unknown;
      result: unknown;
    }
  | {
      kind: "new_build";
      input: unknown;
      result: unknown;
    };

export type CreateShareResponse = {
  token: string;
  expiresAt: string;
};

export type GetShareResponse = {
  estimateData: SharedEstimateSnapshot;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
};

type ErrorResponse = {
  error?: string;
};

export async function shareOrCopy(
  title: string,
  text: string,
  url?: string,
): Promise<void> {
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return;
  }

  await navigator.clipboard.writeText(url ?? text);
}

export async function createSharedEstimate(
  estimateData: SharedEstimateSnapshot,
): Promise<CreateShareResponse> {
  const response = await fetch("/api/share", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ estimateData }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ErrorResponse | null;
    throw new Error(payload?.error ?? "Unable to create share link");
  }

  return (await response.json()) as CreateShareResponse;
}

export async function getSharedEstimate(token: string): Promise<GetShareResponse> {
  const response = await fetch(`/api/share?token=${encodeURIComponent(token)}`, {
    method: "GET",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ErrorResponse | null;
    const error = new Error(payload?.error ?? "Unable to fetch shared estimate") as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  return (await response.json()) as GetShareResponse;
}
