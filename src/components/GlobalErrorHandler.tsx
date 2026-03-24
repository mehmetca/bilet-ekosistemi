"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { isBenignSupabaseRefreshTokenMessage } from "@/lib/supabase-auth-errors";

export default function GlobalErrorHandler({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<{ message: string; stack?: string } | null>(null);

  useEffect(() => {
    const CHUNK_RELOAD_GUARD_KEY = "__chunk_reload_once__";

    // Kamera/video kapatılırken tarayıcının verdiği benign hatalar; sayfa hata ekranı göstermeyelim.
    function isBenignMediaError(msg: string): boolean {
      const s = msg.toLowerCase();
      return (
        s.includes("the play() request was interrupted") ||
        s.includes("the operation was aborted") ||
        (s.includes("abort") && (s.includes("media") || s.includes("element") || s.includes("document")))
      );
    }

    // React/DOM reconciliation sırasında nadiren görülen benign hata.
    // (örn. route geçişinde node zaten kaldırılmışsa)
    function isBenignDomDetachError(msg: string): boolean {
      const s = msg.toLowerCase();
      return (
        s.includes("failed to execute 'removechild' on 'node'") ||
        (s.includes("removechild") && s.includes("not a child of this node"))
      );
    }

    function isChunkLoadError(msg: string): boolean {
      const s = msg.toLowerCase();
      return (
        s.includes("chunkloaderror") ||
        s.includes("loading chunk") ||
        (s.includes("failed to fetch dynamically imported module") && s.includes("/_next/static/chunks"))
      );
    }

    function triggerChunkHardReloadOnce() {
      try {
        if (sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) === "1") return;
        sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, "1");
      } catch {
        /* ignore sessionStorage access errors */
      }
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      const msg = event.message || "Bilinmeyen hata";
      if (isChunkLoadError(msg)) {
        event.preventDefault();
        triggerChunkHardReloadOnce();
        return;
      }
      if (
        isBenignMediaError(msg) ||
        isBenignDomDetachError(msg) ||
        isBenignSupabaseRefreshTokenMessage(msg)
      ) {
        event.preventDefault();
        return;
      }
      console.error("[GlobalErrorHandler] window.onerror:", msg, event.filename, event.lineno, event.colno);
      setError({ message: msg, stack: event.error?.stack });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const msg = event.reason instanceof Error ? event.reason.message : String(event.reason);

      if (isChunkLoadError(msg)) {
        event.preventDefault();
        triggerChunkHardReloadOnce();
        return;
      }

      if (isBenignMediaError(msg) || isBenignDomDetachError(msg)) {
        event.preventDefault();
        return;
      }

      if (isBenignSupabaseRefreshTokenMessage(msg)) {
        event.preventDefault();
        void supabase.auth.signOut({ scope: "local" }).catch(() => {});
        return;
      }

      console.error("[GlobalErrorHandler] unhandledrejection:", msg, event.reason);
      setError({
        message: msg,
        stack: event.reason instanceof Error ? event.reason.stack : undefined,
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  if (error) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "#f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          color: "#0f172a",
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: "1rem",
            border: "2px solid #ef4444",
            padding: "2rem",
            maxWidth: "32rem",
            width: "100%",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#b91c1c", marginBottom: "0.5rem" }}>
            Sayfa hata verdi
          </h2>
          <p style={{ color: "#64748b", marginBottom: "1rem", fontSize: "0.875rem" }}>
            Aşağıdaki hata sayfanın beyaza dönmesine neden oldu. Lütfen bu metni kopyalayıp geliştiriciye iletin.
          </p>
          <pre
            style={{
              background: "#fef2f2",
              color: "#991b1b",
              padding: "1rem",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
              overflow: "auto",
              maxHeight: "12rem",
              marginBottom: "1rem",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => {
                setError(null);
                window.location.reload();
              }}
              style={{
                padding: "0.5rem 1rem",
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Sayfayı yenile
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              style={{
                padding: "0.5rem 1rem",
                background: "#e2e8f0",
                color: "#475569",
                border: "none",
                borderRadius: "0.5rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Kapat (tekrar deneyin)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
