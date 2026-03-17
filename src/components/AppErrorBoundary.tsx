"use client";

import React from "react";

interface State {
  hasError: boolean;
  error?: Error;
}

export default class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("AppErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
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
              border: "1px solid #e2e8f0",
              padding: "2rem",
              maxWidth: "28rem",
              width: "100%",
              textAlign: "center",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
              Bir Hata Oluştu
            </h2>
            <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
              Sayfa yüklenirken bir sorun oluştu. Lütfen sayfayı yenileyin.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
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
              Yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
