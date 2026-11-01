"use client";

import { supabase } from "@/lib/supabase-client";

/**
 * Kapıda çevrimdışı giriş: manifest ve tarama kuyruğu tarayıcıda (IndexedDB) tutulur.
 * Sunucuya yazma yalnız internet geldiğinde yapılır; cihaz saatı ayrı saklanır ki
 * mutabakat raporunda "cihazda yeşil, sunucuda kırmızı" ayrımı kaybolmasın.
 */

const DB_NAME = "kurdevents-door";
const DB_VERSION = 1;
const STORE_MANIFEST = "manifests";
const STORE_QUEUE = "queue";
const STORE_META = "meta";

export type ManifestEntry = {
  code: string;
  kind: "unit" | "seat" | "order";
  ref: string;
  used: string | null;
  section: string | null;
  row: string | null;
  seat: string | null;
};

export type DoorManifest = {
  eventId: string;
  generatedAt: string;
  event: { id: string; title: string | null; date: string | null; time: string | null; location: string | null };
  total: number;
  used: number;
  entries: Record<string, ManifestEntry>;
};

export type QueuedScan = {
  client_event_id: string;
  event_id: string;
  code: string;
  scanned_at: string;
  section?: string | null;
  row?: string | null;
  seat?: string | null;
  sent_at?: string | null;
  server_verdict?: string | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MANIFEST)) {
        db.createObjectStore(STORE_MANIFEST, { keyPath: "eventId" });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const store = db.createObjectStore(STORE_QUEUE, { keyPath: "client_event_id" });
        store.createIndex("by_event", "event_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = work(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

/** Cihaz kimliği: log satırlarını birbirinden ayırmaya yarar, kullanıcı verisi değildir. */
export async function getDeviceId(): Promise<string> {
  const KEY = "device_id";
  const existing = await run<{ key: string; value: string } | undefined>(
    STORE_META,
    "readonly",
    (s) => s.get(KEY)
  );
  if (existing?.value) return existing.value;
  const value = crypto.randomUUID();
  await run(STORE_META, "readwrite", (s) => s.put({ key: KEY, value }));
  return value;
}

export async function saveManifest(
  eventId: string,
  raw: {
    generated_at: string;
    event: DoorManifest["event"];
    total: number;
    used: number;
    entries: ManifestEntry[];
  }
): Promise<DoorManifest> {
  const manifest: DoorManifest = {
    eventId,
    generatedAt: raw.generated_at,
    event: raw.event,
    total: raw.total,
    used: raw.used,
    entries: Object.fromEntries((raw.entries || []).map((e) => [e.code.toUpperCase(), e])),
  };
  await run(STORE_MANIFEST, "readwrite", (s) => s.put(manifest));
  return manifest;
}

export function loadManifest(eventId: string): Promise<DoorManifest | undefined> {
  return run<DoorManifest | undefined>(STORE_MANIFEST, "readonly", (s) => s.get(eventId));
}

export function listManifests(): Promise<DoorManifest[]> {
  return run<DoorManifest[]>(STORE_MANIFEST, "readonly", (s) => s.getAll());
}

export function clearManifest(eventId: string): Promise<unknown> {
  return run(STORE_MANIFEST, "readwrite", (s) => s.delete(eventId));
}

export async function pendingScans(eventId?: string): Promise<QueuedScan[]> {
  const all = await run<QueuedScan[]>(STORE_QUEUE, "readonly", (s) => s.getAll());
  const list = eventId ? all.filter((q) => q.event_id === eventId) : all;
  return list.sort((a, b) => a.scanned_at.localeCompare(b.scanned_at));
}

export function queueScan(scan: QueuedScan): Promise<unknown> {
  return run(STORE_QUEUE, "readwrite", (s) => s.put(scan));
}

export function removeScans(ids: string[]): Promise<unknown> {
  return run(STORE_QUEUE, "readwrite", (s) => {
    let req: IDBRequest | undefined;
    for (const id of ids) req = s.delete(id);
    return req;
  });
}

export type OfflineDecision = {
  state: "available" | "used" | "unknown";
  entry?: ManifestEntry;
};
/**
 * Çevrimdışı karar: kod bu etkinliğin listesinde var mı ve kullanılmamış mı.
 * Kuyruktaki okumalar da "kullanılmış" sayılır — aynı bilet ikinci kez yeşil olmasın.
 */
export async function decideOffline(
  eventId: string,
  code: string
): Promise<OfflineDecision> {
  const key = code.trim().toUpperCase();
  const manifest = await loadManifest(eventId);
  if (!manifest) return { state: "unknown" };
  const entry = manifest.entries[key];
  if (!entry) return { state: "unknown" };
  if (entry.used) return { state: "used", entry };
  const queued = await run<QueuedScan[]>(STORE_QUEUE, "readonly", (s) =>
    s.index("by_event").getAll(eventId)
  );
  if (queued.some((q) => q.code.toUpperCase() === key && !q.server_verdict)) {
    return { state: "used", entry };
  }
  return { state: "available", entry };
}

export type SyncCounts = {
  sent: number;
  entry: number;
  duplicate: number;
  unknown: number;
  denied: number;
};

export type SyncConflict = { code: string; verdict: string };

const REPLAY_CHUNK = 300;

/**
 * Kuyruğu sunucuya yazar. Sunucu her okumayı check_ticket_door'dan geçirdiği için
 * "cihazda yeşil, sunucuda kullanılmış" çakışmaları burada ortaya çıkar.
 * `denied` satırları sunucuda log bırakmaz (yetki dışı etkinlik) — silinir ama
 * conflict olarak raporlanır, görevli hangi bileti neden geçemediğini görür.
 */
export async function syncPending(
  eventId?: string
): Promise<{ counts: SyncCounts; conflicts: SyncConflict[] }> {
  const counts: SyncCounts = { sent: 0, entry: 0, duplicate: 0, unknown: 0, denied: 0 };
  const pending = await pendingScans(eventId);
  if (pending.length === 0) return { counts, conflicts: [] };

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Oturum gerekli");
  const deviceId = await getDeviceId();
  const conflicts: SyncConflict[] = [];

  for (let i = 0; i < pending.length; i += REPLAY_CHUNK) {
    const chunk = pending.slice(i, i + REPLAY_CHUNK);
    const res = await fetch("/api/checkin/replay/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        device_id: deviceId,
        scans: chunk.map((q) => ({
          code: q.code,
          scanned_at: q.scanned_at,
          client_event_id: q.client_event_id,
        })),
      }),
    });
    const json = (await res.json().catch(() => null)) as
      | {
          success?: boolean;
          message?: string;
          results?: Array<{ client_event_id: string; code: string; verdict: string }>;
        }
      | null;
    if (!res.ok || json?.success !== true) {
      throw new Error(json?.message || "Okumalar sunucuya yazılamadı.");
    }

    const results = json.results || [];
    const done: string[] = [];
    for (const r of results) {
      if (!r?.client_event_id) continue;
      done.push(r.client_event_id);
      counts.sent += 1;
      if (r.verdict === "entry") counts.entry += 1;
      else if (r.verdict === "duplicate") counts.duplicate += 1;
      else if (r.verdict === "denied") counts.denied += 1;
      else counts.unknown += 1;
      if (r.verdict !== "entry") conflicts.push({ code: r.code, verdict: r.verdict });
    }
    // Sunucu yanıt vermediği satır kuyrukta kalır → sonraki denemede yeniden gönderilir.
    await removeScans(done);
  }

  return { counts, conflicts };
}
