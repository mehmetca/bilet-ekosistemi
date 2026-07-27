import { NextResponse } from "next/server";

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * API hata yanıtı: production'da iç hata / DB mesajını sızdırmaz.
 * Geliştirmede ayrıntı kalır; her zaman sunucu loguna yazılır.
 */
export function apiErrorResponse(
  status: number,
  publicMessage: string,
  internalError?: unknown
): NextResponse {
  if (internalError !== undefined) {
    console.error(`[api ${status}]`, publicMessage, internalError);
  }

  const body: { error: string; details?: string } = { error: publicMessage };

  if (!IS_PROD && internalError !== undefined) {
    body.details =
      internalError instanceof Error
        ? internalError.message
        : typeof internalError === "string"
          ? internalError
          : (() => {
              try {
                return JSON.stringify(internalError);
              } catch {
                return String(internalError);
              }
            })();
  }

  return NextResponse.json(body, { status });
}

/** Supabase / Error.message'ı istemciye vermeden güvenli metin. */
export function publicErrorMessage(
  fallback: string,
  err?: { message?: string } | Error | null
): string {
  if (IS_PROD) return fallback;
  const msg = err instanceof Error ? err.message : err?.message;
  return msg?.trim() ? msg : fallback;
}
