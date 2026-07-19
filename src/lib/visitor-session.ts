/** Ziyaretçi (staff olmayan) oturum boşta kalma süresi. */
export const VISITOR_IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
export const VISITOR_ACTIVITY_STORAGE_KEY = "ke_visitor_last_activity";

export function readVisitorLastActivity(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VISITOR_ACTIVITY_STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function touchVisitorActivity(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VISITOR_ACTIVITY_STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearVisitorActivity(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(VISITOR_ACTIVITY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function isVisitorIdleExpired(now = Date.now()): boolean {
  const last = readVisitorLastActivity();
  if (last == null) return false;
  return now - last > VISITOR_IDLE_TIMEOUT_MS;
}
