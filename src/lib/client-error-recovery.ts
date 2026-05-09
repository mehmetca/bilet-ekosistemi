/** Geçici hidrasyon / çeviri / çift React hatalarında tam yenileme (aynı sekmede en fazla ~2 dk’da bir). */
export const TRANSIENT_REACT_ERROR_STORAGE_KEY = "__kurd_events_transient_reload_v1";

const COOLDOWN_MS = 120_000;

export function isTransientReactClientError(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("hydration") ||
    msg.includes("reactcurrentowner") ||
    msg.includes("does not match the server") ||
    msg.includes("text content does not match") ||
    msg.includes("server-rendered html") ||
    msg.includes("did not match the client") ||
    msg.includes("minified react error #418") ||
    msg.includes("minified react error #423") ||
    msg.includes("minified react error #425") ||
    msg.includes("there was an error while hydrating")
  );
}

/** true dönerse sayfa hemen yenilenir; çağırıcı ek iş yapmasın. */
export function tryReloadOnceForTransientReactError(errorMessage: string): boolean {
  if (typeof window === "undefined") return false;
  if (!isTransientReactClientError(errorMessage)) return false;
  const now = Date.now();
  try {
    const raw = sessionStorage.getItem(TRANSIENT_REACT_ERROR_STORAGE_KEY);
    if (raw) {
      const last = parseInt(raw, 10);
      if (!Number.isNaN(last) && now - last < COOLDOWN_MS) return false;
    }
    sessionStorage.setItem(TRANSIENT_REACT_ERROR_STORAGE_KEY, String(now));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
