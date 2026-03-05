"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div style={{ background: "white", borderRadius: "1rem", border: "1px solid #e2e8f0", padding: "2rem", maxWidth: "28rem", width: "100%", textAlign: "center" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem" }}>Bir Hata Oluştu</h2>
        <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>Uygulamada beklenmedik bir hata oluştu. Lütfen tekrar deneyin.</p>
        {error?.message && (
          <details style={{ marginBottom: "1rem", textAlign: "left" }}>
            <summary style={{ fontSize: "0.875rem", color: "#64748b", cursor: "pointer" }}>Hata detayları</summary>
            <pre style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#94a3b8", background: "#f1f5f9", padding: "0.5rem", borderRadius: "0.25rem", overflow: "auto", maxHeight: "8rem" }}>
              {error.message}
              {error.digest ? `\n\nDigest: ${error.digest}` : ""}
            </pre>
          </details>
        )}
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
