"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Users, Trash2 } from "lucide-react";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { supabase } from "@/lib/supabase-client";
import { getAccessTokenForApi } from "@/lib/supabase-auth-token";
import { isAmedSporEvent } from "@/lib/amed-spor-utils";
import { formatEventDateDMY } from "@/lib/date-utils";

type EventOption = {
  id: string;
  title: string;
  date: string;
  show_slug?: string | null;
};

type FormRow = {
  id: string;
  event_id: string;
  full_name: string;
  email: string;
  phone: string;
  organization?: string | null;
  language_preference: string;
  accommodation_preference?: string | null;
  meal_preferences?: string | null;
  meal_other_text?: string | null;
  additional_notes?: string | null;
  created_at: string;
};

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function AmedSporKayitlarPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [rows, setRows] = useState<FormRow[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  /** Kayıt sayılarını sayfalanmış şekilde toplar (RLS select yeterli). */
  const fetchEventIdCounts = useCallback(async (): Promise<Map<string, number>> => {
    const counts = new Map<string, number>();
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error: qError } = await supabase
        .from("event_form_responses")
        .select("event_id")
        .range(offset, offset + pageSize - 1);
      if (qError) break;
      for (const r of (data || []) as Array<{ event_id: string }>) {
        counts.set(r.event_id, (counts.get(r.event_id) || 0) + 1);
      }
      if (!data || data.length < pageSize) break;
    }
    return counts;
  }, []);

  const loadEvents = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingEvents(true);
      setError(null);
      try {
        const { data, error: qError } = await supabase
          .from("events")
          .select("id, title, date, show_slug")
          .order("date", { ascending: false })
          .limit(300);
        if (qError) throw qError;

        const counts = await fetchEventIdCounts();
        const todayIso = new Date().toISOString().slice(0, 10);

        const amedEvents = ((data || []) as EventOption[]).filter((e) => {
          const slugMatch = isAmedSporEvent(e.show_slug);
          const titleAmed = (e.title || "").toLowerCase().includes("amed");
          const isKomaAmed = (e.title || "").toLowerCase().includes("koma");
          if (!slugMatch && !(titleAmed && !isKomaAmed)) return false;
          const hasResponses = (counts.get(e.id) || 0) > 0;
          const upcoming = String(e.date || "").slice(0, 10) >= todayIso;
          // Kaydı kalmayan GEÇMİŞ maçlar bu sayfadan kaybolur (silinince otomatik gider).
          return hasResponses || upcoming;
        });

        setEvents(amedEvents);
        setSelectedEventId((prev) =>
          amedEvents.some((e) => e.id === prev) ? prev : amedEvents[0]?.id ?? ""
        );
      } catch (e) {
        console.error(e);
        setError("Etkinlikler yüklenemedi.");
      } finally {
        if (!silent) setLoadingEvents(false);
      }
    },
    [fetchEventIdCounts]
  );

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!selectedEventId) {
      setRows([]);
      return;
    }

    async function loadRows() {
      setLoadingRows(true);
      setError(null);
      try {
        const { data, error: qError } = await supabase
          .from("event_form_responses")
          .select(
            "id, event_id, full_name, email, phone, organization, language_preference, accommodation_preference, meal_preferences, meal_other_text, additional_notes, created_at"
          )
          .eq("event_id", selectedEventId)
          .order("created_at", { ascending: false });

        if (qError) throw qError;
        setRows((data || []) as FormRow[]);
      } catch (e) {
        console.error(e);
        setError("Kayıtlar yüklenemedi. Migration uygulandı mı?");
        setRows([]);
      } finally {
        setLoadingRows(false);
      }
    }

    loadRows();
  }, [selectedEventId]);

  function confirmDelete(message: string): boolean {
    return window.confirm(`${message}\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?`);
  }

  async function deleteFromDb(payload: { eventId?: string; responseIds?: string[] }): Promise<number> {
    const token = await getAccessTokenForApi();
    if (!token) {
      alert("Oturum bulunamadı veya süresi doldu. Lütfen sayfayı yenileyip tekrar giriş yapın.");
      return 0;
    }
    const res = await fetch("/api/amed-spor-form", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; deleted?: number };
    if (!res.ok) {
      throw new Error(json.error || "Silme işlemi başarısız.");
    }
    return json.deleted ?? 0;
  }

  async function handleDeleteRow(r: FormRow) {
    if (deletingIds.has(r.id) || deletingEvent) return;
    if (!confirmDelete(`"${r.full_name}" (${r.email}) kaydı silinecek.`)) return;
    setDeletingIds((prev) => new Set(prev).add(r.id));
    try {
      const deleted = await deleteFromDb({ responseIds: [r.id] });
      if (deleted > 0) {
        setRows((prev) => prev.filter((x) => x.id !== r.id));
        await loadEvents(true);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kayıt silinemedi.");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(r.id);
        return next;
      });
    }
  }

  async function handleDeleteAllForEvent() {
    if (!selectedEventId || !selectedEvent || deletingEvent) return;
    if (
      !confirmDelete(
        `"${selectedEvent.title}" (${formatEventDateDMY(selectedEvent.date)}) maçının TÜM kayıtları silinecek (${rows.length} kayıt).`
      )
    ) {
      return;
    }
    setDeletingEvent(true);
    try {
      const deleted = await deleteFromDb({ eventId: selectedEventId });
      if (deleted > 0) {
        setRows([]);
        await loadEvents(true);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Kayıtlar silinemedi.");
    } finally {
      setDeletingEvent(false);
    }
  }

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  function downloadCsv() {
    const header = [
      "full_name",
      "email",
      "phone",
      "organization",
      "language_preference",
      "accommodation_preference",
      "meal_preferences",
      "meal_other_text",
      "additional_notes",
      "created_at",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.full_name,
          r.email,
          r.phone,
          r.organization || "",
          r.language_preference,
          r.accommodation_preference || "",
          r.meal_preferences || "",
          r.meal_other_text || "",
          r.additional_notes || "",
          r.created_at,
        ]
          .map((v) => csvEscape(String(v ?? "")))
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeTitle = (selectedEvent?.title || "amed-spor")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 60);
    a.href = url;
    a.download = `amed-spor-kayitlar-${safeTitle}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminOnlyGuard>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-6 w-6" />
              Amed Spor Kayıtları
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Form ile kaydolan kişilerin listesi (maç başına). CSV indirebilirsiniz.
            </p>
          </div>
          <Link href="/yonetim" className="text-sm text-primary-600 hover:underline">
            Panele dön
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap gap-4 items-end">
          <div className="min-w-[240px] flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Etkinlik</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              disabled={loadingEvents || events.length === 0}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              {events.length === 0 ? (
                <option value="">Amed Spor etkinliği yok</option>
              ) : (
                events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} — {formatEventDateDMY(e.date)}
                  </option>
                ))
              )}
            </select>
          </div>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            CSV indir
          </button>
          {selectedEvent && rows.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAllForEvent}
              disabled={deletingEvent || loadingRows}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              {deletingEvent ? "Siliniyor..." : `Bu maçın tüm kayıtlarını sil (${rows.length})`}
            </button>
          )}
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 text-sm text-slate-600">
            {loadingRows
              ? "Yükleniyor..."
              : `${rows.length} kayıt${selectedEvent ? ` — ${selectedEvent.title}` : ""}`}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Ad Soyad</th>
                  <th className="text-left px-3 py-2 font-semibold">E-posta</th>
                  <th className="text-left px-3 py-2 font-semibold">Telefon</th>
                  <th className="text-left px-3 py-2 font-semibold">Dil</th>
                  <th className="text-left px-3 py-2 font-semibold">Yemek</th>
                  <th className="text-left px-3 py-2 font-semibold">Konaklama</th>
                  <th className="text-left px-3 py-2 font-semibold">Not</th>
                  <th className="text-left px-3 py-2 font-semibold">Tarih</th>
                  <th className="text-left px-3 py-2 font-semibold">Sil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loadingRows && rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                      Bu etkinlik için kayıt yok.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2 font-medium text-slate-900">{r.full_name}</td>
                      <td className="px-3 py-2">{r.email}</td>
                      <td className="px-3 py-2">{r.phone}</td>
                      <td className="px-3 py-2">{r.language_preference}</td>
                      <td className="px-3 py-2">
                        {r.meal_preferences || "-"}
                        {r.meal_other_text ? ` (${r.meal_other_text})` : ""}
                      </td>
                      <td className="px-3 py-2">{r.accommodation_preference || "-"}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate" title={r.additional_notes || ""}>
                        {r.additional_notes || "-"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.created_at ? new Date(r.created_at).toLocaleString("tr-TR") : "-"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(r)}
                          disabled={deletingIds.has(r.id) || deletingEvent}
                          title="Bu kaydı sil"
                          className="inline-flex items-center justify-center rounded-md border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminOnlyGuard>
  );
}
