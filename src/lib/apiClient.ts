const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export class ApiFetchError extends Error {
  status: number;
  path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "ApiFetchError";
    this.status = status;
    this.path = path;
  }
}

export function isApiFetchError(error: unknown): error is ApiFetchError {
  return error instanceof ApiFetchError;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(init?.headers ?? undefined);
  const isFormDataBody =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (!isFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...init,
    headers
  });

  if (!res.ok) {
    let message = `API error ${res.status}: ${path}`;

    try {
      const payload = (await res.clone().json()) as unknown;
      if (payload && typeof payload === "object") {
        const data = payload as Record<string, unknown>;
        if (typeof data.error === "string" && data.error.trim()) {
          message = data.error;
        } else if (typeof data.message === "string" && data.message.trim()) {
          message = data.message;
        }
      }
    } catch {
      // Keep fallback message if response is not JSON.
    }

    throw new ApiFetchError(message, res.status, path);
  }

  return res;
}
