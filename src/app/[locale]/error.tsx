"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getTranslationWarning } from "@/i18n/translation-warning";
import { tryReloadOnceForTransientReactError } from "@/lib/client-error-recovery";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV === "development";
  const pathname = usePathname();
  const localeFromPath = pathname?.split("/")[1];
  const translationWarning = getTranslationWarning(localeFromPath);

  useEffect(() => {
    if (tryReloadOnceForTransientReactError(String(error?.message || ""))) return;
    console.error("Locale error:", error);
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@sentry/nextjs")
        .then((m) => {
          m.captureException?.(error, {
            tags: {
              errorBoundary: "locale",
              errorType: error?.message?.includes("lazy") ? "lazy_undefined" : "unknown",
            },
          });
        })
        .catch(() => {});
    }
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "white", borderRadius: "1rem", border: "1px solid #e2e8f0", padding: "2rem", maxWidth: "28rem", width: "100%", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem" }}>Bir Hata Oluştu</h2>
        <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>Uygulamada beklenmedik bir hata oluştu. Lütfen tekrar deneyin.</p>
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
        {(isDev && error?.message) || error?.digest ? (
          <details style={{ marginBottom: "1rem", textAlign: "left" }}>
            <summary style={{ fontSize: "0.875rem", color: "#64748b", cursor: "pointer" }}>
              {isDev ? "Hata detayları" : "Teknik bilgi (destek için)"}
            </summary>
            <pre style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#94a3b8", background: "#f1f5f9", padding: "0.5rem", borderRadius: "0.25rem", overflow: "auto", maxHeight: "8rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {error.digest ? `Digest: ${error.digest}\n\n` : ""}
              {isDev ? error.message : error.message ? `${error.message.slice(0, 200)}${error.message.length > 200 ? "…" : ""}` : ""}
            </pre>
          </details>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <button
            onClick={reset}
            style={{ width: "100%", padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: "0.5rem", fontWeight: 600, cursor: "pointer" }}
          >
            Tekrar Dene
          </button>
          <a href="/" style={{ display: "block", width: "100%", padding: "0.5rem 1rem", border: "1px solid #cbd5e1", color: "#334155", borderRadius: "0.5rem", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
            Ana Sayfaya Dön
          </a>
        </div>
      </div>
    </div>
  );
}
