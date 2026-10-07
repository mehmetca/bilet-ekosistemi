"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, LogIn, UserX, Users } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

const DOOR_STATS_REFRESH_MS = 15_000;

export type DoorOperatorStat = {
  userId?: string | null;
  name?: string | null;
  ok?: number;
  duplicate?: number;
  invalid?: number;
  lastAt?: string | null;
};

export type DoorStats = {
  eventId?: string | null;
  expected?: number;
  arrived?: number;
  remaining?: number;
  lastAt?: string | null;
  operators?: DoorOperatorStat[];
};

function formatTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Sayımlar checked_at üzerinden yapılır; görevli kırılımı 122 migration'ından
 * sonraki okumaları kapsar. 15 sn'de bir, yalnızca sekme görünürken yoklanır.
 */
export default function DoorCounters({
  eventId,
  className = "",
}: {
  eventId?: string | null;
  className?: string;
}) {
  const [stats, setStats] = useState<DoorStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (!eventId || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("Oturum bulunamadı.");
        return;
      }
      const res = await fetch(
        `/api/door-stats?event_id=${encodeURIComponent(eventId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        message?: string;
        stats?: DoorStats;
      };
      if (!res.ok) {
        setError(payload?.message || "Kapı sayıları alınamadı.");
        return;
      }
      setStats(payload.stats ?? null);
      setError(null);
    } catch {
      setError("Bağlantı kurulamadı.");
    } finally {
      inFlightRef.current = false;
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) {
      setStats(null);
      setError(null);
      return;
    }
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load();
    }, DOOR_STATS_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [eventId, load]);

  if (!eventId) return null;

  const operators = stats?.operators ?? [];

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 ${className}`}
      aria-label="Kapı sayıları"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-slate-900">Kapı özeti</h2>
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          Son okuma: {formatTime(stats?.lastAt)}
        </span>
      </div>

      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-xl border border-green-200 bg-green-50 p-2.5 sm:p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-700">
              <LogIn className="h-4 w-4" />
              Gelen
            </div>
            <div className="mt-1 text-xl font-bold text-green-800 sm:text-2xl">{stats?.arrived ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
            <div className="text-xs font-medium text-slate-600">Kalan</div>
            <div className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{stats?.remaining ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
            <div className="text-xs font-medium text-slate-600">Satılan</div>
            <div className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{stats?.expected ?? 0}</div>
          </div>
        </div>
      )}

      {operators.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Users className="h-4 w-4" />
            Görevli kırılımı
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {operators.map((op, index) => (
              <li key={op.userId ?? `anon-${index}`} className="flex items-center justify-between gap-3 py-1.5">
                <span className="truncate text-slate-800">{op.name || "Bilinmeyen görevli"}</span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  <span className="font-semibold text-green-700" title="Giriş işaretlenen okuma">
                    {op.ok ?? 0} giriş
                  </span>
                  {(op.duplicate ?? 0) > 0 ? (
                    <span
                      className="flex items-center gap-1 text-red-600"
                      title="Mükerrer okuma (bilet zaten kullanılmış)"
                    >
                      <UserX className="h-3.5 w-3.5" />
                      {op.duplicate}
                    </span>
                  ) : null}
                  {(op.invalid ?? 0) > 0 ? (
                    <span className="text-amber-600" title="Bulunamadı veya geçersiz okuma">
                      {op.invalid} hatalı
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
