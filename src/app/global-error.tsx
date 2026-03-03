"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#f8fafc",
        }}>
          <div style={{
            maxWidth: "28rem",
            width: "100%",
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "1rem",
            border: "1px solid #e2e8f0",
            textAlign: "center",
          }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#0f172a", marginBottom: "0.5rem" }}>
              Bir Hata Oluştu
            </h2>
            <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
              Uygulamada beklenmedik bir hata oluştu.
            </p>
            <button
              onClick={() => reset()}
              style={{
                width: "100%",
                padding: "0.5rem 1rem",
                backgroundColor: "#2563eb",
                color: "white",
                fontWeight: 600,
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
              }}
            >
              Tekrar Dene
            </button>
            <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#94a3b8" }}>
              Sorun devam ederse dev sunucusunu yeniden başlatın (Ctrl+C sonra npm run dev)
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
