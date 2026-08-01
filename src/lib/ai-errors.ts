// Kept free of heavy imports so it can be reasoned about, and tested, on its own.

// Google returns 503 whenever the shared free-tier capacity is saturated, and
// 429 when the per-minute rate limit is hit. Both are transient and say nothing
// about the API key, so they are worth riding out rather than surfacing.
export const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export function statusOf(error: unknown): number {
  return Number((error as { status?: number })?.status) || 0;
}

export function isRetryable(error: unknown): boolean {
  return RETRYABLE_STATUSES.has(statusOf(error));
}

export type AiErrorInfo = { status: number; retryable: boolean; message: string };

/** Turns a raw SDK error into something worth showing a teacher. */
export function describeAiError(error: unknown): AiErrorInfo {
  const status = statusOf(error);

  if (status === 429)
    return {
      status,
      retryable: true,
      message:
        "Gemini's free-tier rate limit was reached (about 10 requests a minute). Wait a minute and upload again. Your key is fine.",
    };

  if (RETRYABLE_STATUSES.has(status))
    return {
      status,
      retryable: true,
      message:
        "Google's servers are busy and stayed busy through several retries. This is temporary and is not a problem with your API key. Try again in a few minutes.",
    };

  if (status === 401 || status === 403)
    return {
      status,
      retryable: false,
      message:
        "Gemini rejected your API key. Check GEMINI_API_KEY in .env, then restart the dev server.",
    };

  if (status === 400)
    return {
      status,
      retryable: false,
      message:
        "Gemini could not read this file. If it is a scan, try exporting it as a PDF or PNG and upload again.",
    };

  if (error instanceof SyntaxError)
    return {
      status: 0,
      retryable: true,
      message:
        "The model's reply was cut off before it finished, which usually means the task sheet is very long. Try again, or split it into two uploads.",
    };

  return {
    status,
    retryable: false,
    message:
      "The document could not be parsed. The server log has the underlying error.",
  };
}
