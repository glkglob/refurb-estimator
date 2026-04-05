type ErrorLike = {
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  message?: unknown;
};

export type AiErrorMapping = {
  status: number;
  message: string;
};

function asErrorLike(error: unknown): ErrorLike | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  return error as ErrorLike;
}

function getStatus(error: unknown): number | undefined {
  const errorLike = asErrorLike(error);
  if (!errorLike) {
    return undefined;
  }

  if (typeof errorLike.status === "number") {
    return errorLike.status;
  }

  if (typeof errorLike.statusCode === "number") {
    return errorLike.statusCode;
  }

  return undefined;
}

function getCode(error: unknown): string | undefined {
  const errorLike = asErrorLike(error);
  if (!errorLike || typeof errorLike.code !== "string") {
    return undefined;
  }

  return errorLike.code;
}

function getMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  const errorLike = asErrorLike(error);
  if (errorLike && typeof errorLike.message === "string") {
    return errorLike.message;
  }

  return "";
}

function hasNetworkError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("econn") ||
    normalized.includes("etimedout") ||
    normalized.includes("timeout") ||
    normalized.includes("enotfound")
  );
}

function isMissingApiKey(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("openai_api_key") ||
    (normalized.includes("api key") && normalized.includes("openai"))
  );
}

function isMalformedJson(error: unknown, message: string): boolean {
  if (error instanceof SyntaxError) {
    return true;
  }

  const normalized = message.toLowerCase();
  return normalized.includes("invalid json") || normalized.includes("unexpected token");
}

export function mapAiProviderError(
  error: unknown,
  fallbackMessage: string
): AiErrorMapping {
  const status = getStatus(error);
  const code = getCode(error)?.toLowerCase();
  const message = getMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (isMissingApiKey(message)) {
    return {
      status: 500,
      message: "AI service is not configured. Set OPENAI_API_KEY."
    };
  }

  if (isMalformedJson(error, message)) {
    return {
      status: 502,
      message: "AI provider returned malformed JSON."
    };
  }

  if (
    status === 404 ||
    (normalizedMessage.includes("model") && normalizedMessage.includes("not found"))
  ) {
    return {
      status: 502,
      message: "Configured AI model was not found."
    };
  }

  if (
    status === 429 ||
    code === "resource_exhausted" ||
    normalizedMessage.includes("rate limit")
  ) {
    return {
      status: 503,
      message: "AI provider rate limit exceeded. Please retry shortly."
    };
  }

  if (hasNetworkError(message)) {
    return {
      status: 503,
      message: "Network error while contacting AI provider. Please retry."
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: 502,
      message: "AI provider authentication failed. Check API key permissions."
    };
  }

  if (
    status === 400 ||
    code === "invalid_argument" ||
    code === "invalid_request_error"
  ) {
    return {
      status: 502,
      message: "AI provider rejected the request payload."
    };
  }

  if (typeof status === "number" && status >= 500) {
    return {
      status: 503,
      message: "AI provider is temporarily unavailable."
    };
  }

  return {
    status: 500,
    message: fallbackMessage
  };
}
