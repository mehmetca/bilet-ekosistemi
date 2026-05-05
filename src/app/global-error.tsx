"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getTranslationWarning } from "@/i18n/translation-warning";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const localeFromPath = pathname?.split("/")[1];
  const translationWarning = getTranslationWarning(localeFromPath);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@sentry/nextjs")
        .then((m) => m.captureException?.(error))
        .catch(() => {});
    }
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <html lang="tr">
      <body>
        <div
          style={{
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            maxWidth: "480px",
            margin: "0 auto",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Bir hata oluştu</h1>
          <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
            Üzgünüz, beklenmeyen bir hata meydana geldi.
          </p>
          <p
            style={{
              marginBottom: "1rem",
              background: "#fff7ed",
              color: "#9a3412",
              border: "1px solid #fed7aa",
              borderRadius: "0.5rem",
              padding: "0.75rem",
              fontSize: "0.875rem",
            }}
          >
            {translationWarning}
          </p>
          {isDev && error?.message && (
            <details
              style={{
                marginBottom: "1.5rem",
                textAlign: "left",
                background: "#f8fafc",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
              }}
            >
              <summary style={{ cursor: "pointer", color: "#64748b" }}>Hata detayı</summary>
              <pre style={{ marginTop: "0.5rem", overflow: "auto", whiteSpace: "pre-wrap" }}>
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            </details>
          )}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                cursor: "pointer",
                background: "#0f172a",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 600,
              }}
            >
              Tekrar dene
            </button>
            <a
              href="/"
              style={{
                padding: "0.5rem 1rem",
                background: "#e2e8f0",
                color: "#334155",
                textDecoration: "none",
                borderRadius: "0.5rem",
                fontWeight: 600,
              }}
            >
              Ana Sayfaya Dön
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
