"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Trash2, UploadCloud, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import {
  clearManifest,
  listManifests,
  pendingScans,
  saveManifest,
  syncPending,
  type DoorManifest,
  type ManifestEntry,
} from "@/lib/offline-checkin";

type EventOption = { id: string; title: string; date: string | null; time: string | null };

type Props = {
  armedEventId: string | null;
  onArmedChange: (eventId: string | null) => void;
  /** Sayfa yeni bir çevrimdışı okuma kuyruğuna yazdığında artar — sayaç taze kalsın. */
  queueTick: number;
};

/**
 * Kapı için çevrimdışı hazırlık paneli: giriş listesini cihaz indirir,
 * internet kesilince taramalar kuyruğa yazılır, bağlantı gelince buradan gönderilir.
 */
export default function OfflineDoorPanel({ armedEventId, onArmedChange, queueTick }: Props) {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState("");
  const [stored, setStored] = useState<Record<string, DoorManifest>>({});
  const [pendingCount, setPendingCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  const refreshLocal = useCallback(async () => {
    const [manifests, queue] = await Promise.all([listManifests(), pendingScans()]);
    setStored(Object.fromEntries(manifests.map((m) => [m.eventId, m])));
    setPendingCount(queue.length);
  }, []);

  useEffect(() => {
    const up = () => {
      setOnline(true);
      // Bağlantı döndüğünde kuyruk kendiliğinden gider: client_event_id anahtarı
      // sayesinde çift tıklama sunucuda ikinci satırı üretmez.
      void syncPending()
        .then(refreshLocal)
        .catch(() => setError("Kuyruk otomatik gönderilemedi."));
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [refreshLocal]);

  useEffect(() => {
    void refreshLocal().catch(() => setError("Cihazdaki liste okunamadı."));
  }, [refreshLocal, queueTick]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/staff-events/?from=${today}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as { events?: EventOption[] } | null;
      if (cancelled || !res.ok) return;
      const rows = Array.isArray(json?.events) ? json.events : [];
      setEvents(rows);
      setEventId((current) => current || rows[0]?.id || "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cihazda tek bir liste yüklüyse görevlinin yeniden basmasına gerek olmasın.
  useEffect(() => {
    if (armedEventId) return;
    const keys = Object.keys(stored);
    if (keys.length === 1) onArmedChange(keys[0]);
  }, [stored, armedEventId, onArmedChange]);

  async function download() {
    if (!eventId || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) throw new Error("Bu cihazda giriş yapın.");
      const res = await fetch(`/api/checkin/manifest/?event_id=${encodeURIComponent(eventId)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as
        | {
            success?: boolean;
            message?: string;
            generated_at?: string;
            event?: DoorManifest["event"];
            total?: number;
            used?: number;
            entries?: ManifestEntry[];
          }
        | null;
      if (!res.ok || json?.success !== true || !json.event) {
        throw new Error(json?.message || "Liste indirilemedi.");
      }
      const saved = await saveManifest(eventId, {
        generated_at: String(json.generated_at),
        event: json.event,
        total: Number(json.total ?? 0),
        used: Number(json.used ?? 0),
        entries: Array.isArray(json.entries) ? json.entries : [],
      });
      onArmedChange(eventId);
      setMessage(
        `${saved.event.title || "Etkinlik"} · ${saved.total} bilet, ${saved.used} tanesi zaten kullanılmış.`
      );
      await refreshLocal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Liste indirilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { counts, conflicts } = await syncPending();
      const parts = [
        `${counts.sent} okuma gönderildi`,
        `${counts.entry} giriş`,
        counts.duplicate ? `${counts.duplicate} mükerrer` : null,
        counts.unknown ? `${counts.unknown} listede yok` : null,
        counts.denied ? `${counts.denied} yetki dışı` : null,
      ].filter(Boolean);
      setMessage(parts.join(" · "));
      if (conflicts.length > 0) {
        setError(
          `Sunucuda reddedilen okumalar: ${conflicts
            .slice(0, 3)
            .map((c) => `${c.code} (${c.verdict})`)
            .join(", ")}${conflicts.length > 3 ? "…" : ""}`
        );
      }
      await refreshLocal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kuyruk gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function removeList() {
    if (!armedEventId || busy) return;
    setBusy(true);
    try {
      await clearManifest(armedEventId);
      onArmedChange(null);
      setMessage("Cihazdaki liste silindi.");
      await refreshLocal();
    } finally {
      setBusy(false);
    }
  }

  const armed = armedEventId ? stored[armedEventId] : undefined;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {online ? (
            <Wifi className="h-4 w-4 text-green-600" />
          ) : (
            <WifiOff className="h-4 w-4 text-amber-600" />
          )}
          Çevrimdışı giriş modu
        </h2>
        <span className="text-xs text-slate-500">
          {pendingCount > 0 ? `${pendingCount} okuma gönderilmeyi bekliyor` : "Bekleyen okuma yok"}
        </span>
      </div>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        İnternet kesilirse taramalar cihazdaki giriş listesinden karar verir, sonra burada
        sunucuya yazılır. Liste yalnız etkinlik gününden önce indirilir; alıcı adı/e-posta
        cihazda tutulmaz.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="min-h-[44px] min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 text-sm"
        >
          {events.length === 0 ? <option value="">Etkinlik bulunamadı</option> : null}
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} {e.date ? `· ${new Date(e.date).toLocaleDateString("tr-TR")}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void download()}
          disabled={busy || !eventId}
          className="flex min-h-[44px] items-center gap-2 rounded-lg bg-slate-800 px-3 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Listeyi indir
        </button>
        <button
          type="button"
          onClick={() => void upload()}
          disabled={busy || pendingCount === 0}
          className="flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          <UploadCloud className="h-4 w-4" /> Kuyruğu gönder
        </button>
        {armed ? (
          <button
            type="button"
            onClick={() => void removeList()}
            disabled={busy}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Listeyi sil
          </button>
        ) : null}
      </div>

      {armed ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
          <RefreshCw className="h-3.5 w-3.5" />
          Aktif liste: {armed.event.title || "Etkinlik"} · {armed.total} bilet ·
          indirilme {new Date(armed.generatedAt).toLocaleString("tr-TR")}
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Çevrimdışı karar için aktif liste yok.
        </p>
      )}

      {message ? <p className="mt-2 text-xs text-green-700">{message}</p> : null}
      {error ? (
        <p className="mt-2 flex items-start gap-2 text-xs text-red-700">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </p>
      ) : null}
    </section>
  );
}
