"use client";

import { useEffect, useState } from "react";
import { isBenignSupabaseRefreshTokenMessage } from "@/lib/supabase-auth-errors";

const MAX_LOGS = 20;

function stringifyConsoleArgs(args: unknown[]): string {
  return args
    .map((a) =>
      typeof a === "object" && a !== null
        ? a instanceof Error
          ? a.message + (a.stack ? "\n" + a.stack : "")
          : JSON.stringify(a)
        : String(a)
    )
    .join(" ");
}

function shouldSkipConsoleCapture(type: "error" | "warn", args: unknown[]): boolean {
  const s = stringifyConsoleArgs(args).toLowerCase();
  if (isBenignSupabaseRefreshTokenMessage(s)) return true;
  if (type === "warn" && s.includes("largest contentful paint") && s.includes("priority")) return true;
  return false;
}

export default function ConsoleCapture() {
  const [logs, setLogs] = useState<{ type: string; args: string; time: string }[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;

    function capture(type: "error" | "warn", ...args: unknown[]) {
      if (shouldSkipConsoleCapture(type, args)) return;
      const time = new Date().toLocaleTimeString("tr-TR");
      const argsStr = stringifyConsoleArgs(args);
      setLogs((prev) => [...prev.slice(-(MAX_LOGS - 1)), { type, args: argsStr, time }]);
    }

    console.error = (...args: unknown[]) => {
      capture("error", ...args);
      originalError.apply(console, args);
    };
    console.warn = (...args: unknown[]) => {
      capture("warn", ...args);
      originalWarn.apply(console, args);
    };

    return () => {
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  if (logs.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 40,
        right: 8,
        zIndex: 99997,
        maxWidth: "min(90vw, 480px)",
        background: "#1e293b",
        color: "#e2e8f0",
        borderRadius: 8,
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
        overflow: "hidden",
        fontSize: 12,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "8px 12px",
          background: "#334155",
          color: "#f8fafc",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontWeight: 600,
        }}
      >
        Console hataları ({logs.length}) – {open ? "kapat" : "aç"}
      </button>
      {open && (
        <div style={{ maxHeight: 280, overflow: "auto", padding: 8 }}>
          {logs.map((log, i) => (
            <div
              key={i}
              style={{
                marginBottom: 8,
                padding: 8,
                background: log.type === "error" ? "#7f1d1d" : "#422006",
                borderRadius: 4,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontFamily: "monospace",
              }}
            >
              <span style={{ color: "#94a3b8", marginRight: 8 }}>{log.time}</span>
              <span style={{ color: log.type === "error" ? "#fca5a5" : "#fde047" }}>{log.type}</span>
              <pre style={{ margin: "4px 0 0", fontSize: 11 }}>{log.args}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
