import { unstable_cache } from "next/cache";
import type { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const MAINTENANCE_COOKIE = "ke_mnt";
/** Ziyaretçi çerez TTL — kısa: admin kapatınca en fazla ~45sn içinde açılır */
export const MAINTENANCE_COOKIE_MAX_AGE = 45;

type MemoryCache = { value: boolean; at: number };
let memoryCache: MemoryCache | null = null;
const MEMORY_TTL_MS = 60_000;

async function readMaintenanceFromDb(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .maybeSingle();
  if (error) throw error;
  return data?.value === true;
}

/** RSC: ayar kaydında tag ile invalidate. */
export const getMaintenanceModeCached = unstable_cache(
  async (): Promise<boolean> => {
    try {
      return await readMaintenanceFromDb();
    } catch {
      return false;
    }
  },
  ["maintenance-mode-flag"],
  { revalidate: 60, tags: ["site-settings"] }
);

/**
 * Middleware: çerez → bellek → DB (nadiren).
 * Aynı instance'ta admin kaydı bellek önbelleğini ezer (çerez gecikmesini keser).
 */
export async function resolveMaintenanceMode(
  cookieValue: string | undefined
): Promise<{ enabled: boolean; setCookie: boolean }> {
  const now = Date.now();
  const memFresh = memoryCache && now - memoryCache.at < MEMORY_TTL_MS ? memoryCache : null;

  if (memFresh) {
    if (cookieValue === "1" && memFresh.value === false) {
      return { enabled: false, setCookie: true };
    }
    if (cookieValue === "0" && memFresh.value === true) {
      return { enabled: true, setCookie: true };
    }
    if (cookieValue === "1" || cookieValue === "0") {
      return { enabled: cookieValue === "1", setCookie: false };
    }
    return { enabled: memFresh.value, setCookie: true };
  }

  if (cookieValue === "1") return { enabled: true, setCookie: false };
  if (cookieValue === "0") return { enabled: false, setCookie: false };

  try {
    const enabled = await readMaintenanceFromDb();
    memoryCache = { value: enabled, at: now };
    return { enabled, setCookie: true };
  } catch {
    const enabled = memoryCache?.value ?? false;
    return { enabled, setCookie: true };
  }
}

export function applyMaintenanceCookie(response: NextResponse, enabled: boolean): void {
  response.cookies.set(MAINTENANCE_COOKIE, enabled ? "1" : "0", {
    path: "/",
    maxAge: MAINTENANCE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

/** Ayar kaydı sonrası bu instance bellek önbelleğini anında güncelle. */
export function setMaintenanceModeCache(enabled: boolean): void {
  memoryCache = { value: enabled, at: Date.now() };
}

/** Giriş / yönetim / bakım — ziyaretçi kilidine takılmaz (bakim hariç özel işlenir). */
export function isMaintenanceBypassPath(pathname: string): boolean {
  if (pathname.startsWith("/yonetim")) return true;
  if (pathname.startsWith("/auth")) return true;
  if (pathname.startsWith("/kontrol")) return true;
  return /^\/(?:(?:tr|de|en|ku|ckb)\/)?(?:giris|sifre-yenile)(?:\/|$)/.test(pathname);
}

export function isBakimPath(pathname: string): boolean {
  return /^\/(?:(?:tr|de|en|ku|ckb)\/)?bakim(?:\/|$)/.test(pathname);
}

export async function isMaintenanceModeEnabled(): Promise<boolean> {
  return getMaintenanceModeCached();
}
