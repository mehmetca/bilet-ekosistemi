"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Mail, Search } from "lucide-react";

import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

type ReportEvent = {
  id: string;
  title: string;
  date: string;
  time: string | null;
  venue: string;
  currency: string;
  vatRate: number;
  commissionRate: number | null;
  orders: number;
  tickets: number;
  gross: number;
  invoices: number;
};

type Notice = { kind: "ok" | "err"; text: string };

function money(value: number, currency = "EUR"): string {
  return `${Number(value ?? 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency === "TL" ? "TRY" : currency || "EUR"}`;
}

function shortDate(value: string | null | undefined): string {
  const raw = String(value || "").slice(0, 10);
  const [year, month, day] = raw.split("-");
  return year && month && day ? `${day}.${month}.${year}` : "–";
}

/** Boş alan = komisyon yok (kendi etkinliğimiz); sayı = eski değer. */
function rateToText(rate: number | null): string {
  return rate === null || rate === undefined ? "" : String(rate).replace(".", ",");
}

function EventReportsContent() {
  const { accessToken, loading: authLoading } = useSimpleAuth();
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rates, setRates] = useState<Record<string, string>>({});
  const [savedRates, setSavedRates] = useState<Record<string, number | null>>({});
  const [mailTo, setMailTo] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notices, setNotices] = useState<Record<string, Notice>>({});

  const headers = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken]
  );

  const setNotice = (id: string, notice: Notice) =>
    setNotices((current) => ({ ...current, [id]: notice }));

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/event-reports/", { cache: "no-store", headers });
      const json = (await res.json().catch(() => ({}))) as { events?: ReportEvent[]; error?: string };
      if (!res.ok) {
        setError(json.error || "Etkinlik listesi yüklenemedi.");
        setEvents([]);
        return;
      }
      const list = Array.isArray(json.events) ? json.events : [];
      setEvents(list);
      setRates(Object.fromEntries(list.map((row) => [row.id, rateToText(row.commissionRate)])));
      setSavedRates(Object.fromEntries(list.map((row) => [row.id, row.commissionRate])));
    } catch (err) {
      console.error("event-reports load error:", err);
      setError("Etkinlik listesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, headers]);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      setLoading(false);
      setError("Oturum gerekli. Sayfayı yenileyip tekrar giriş yapın.");
      return;
    }
    void load();
  }, [authLoading, accessToken, load]);

  /** İstekte kullanılacak değer: boş → null (komisyon yok), sayı → number. */
  function rateValue(id: string): number | null {
    const raw = String(rates[id] ?? "").trim().replace(",", ".");
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return Number.NaN;
    return Math.round(parsed * 100) / 100;
  }

  async function commitRate(id: string) {
    const value = rateValue(id);
    if (Number.isNaN(value)) {
      setNotice(id, { kind: "err", text: "Oran 0 ile 100 arasında olmalı." });
      return;
    }
    if (value === savedRates[id]) return;
    setBusy(`${id}:save`);
    try {
      const res = await fetch("/api/admin/event-reports/", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: id, commission_rate: value }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNotice(id, { kind: "err", text: json.error || "Oran kaydedilemedi." });
        return;
      }
      setSavedRates((current) => ({ ...current, [id]: value }));
      setNotice(id, { kind: "ok", text: value === null ? "Oran temizlendi." : `Oran kaydedildi: %${value}` });
    } catch (err) {
      console.error("event-reports save rate error:", err);
      setNotice(id, { kind: "err", text: "Oran kaydedilemedi." });
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf(id: string) {
    const value = rateValue(id);
    if (Number.isNaN(value)) {
      setNotice(id, { kind: "err", text: "Oran 0 ile 100 arasında olmalı." });
      return;
    }
    setBusy(`${id}:pdf`);
    setNotice(id, { kind: "ok", text: "PDF hazırlanıyor..." });
    try {
      const res = await fetch("/api/admin/event-reports/pdf/", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: id, commission_rate: value }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setNotice(id, { kind: "err", text: json.error || "PDF oluşturulamadı." });
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = match?.[1] || "Veranstaltungsabrechnung.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setSavedRates((current) => ({ ...current, [id]: value }));
      setNotice(id, { kind: "ok", text: "PDF indirildi." });
    } catch (err) {
      console.error("event-reports pdf error:", err);
      setNotice(id, { kind: "err", text: "PDF oluşturulamadı." });
    } finally {
      setBusy(null);
    }
  }

  async function sendMail(id: string) {
    const email = String(mailTo[id] ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotice(id, { kind: "err", text: "Geçerli bir e-posta yazın." });
      return;
    }
    const value = rateValue(id);
    if (Number.isNaN(value)) {
      setNotice(id, { kind: "err", text: "Oran 0 ile 100 arasında olmalı." });
      return;
    }
    setBusy(`${id}:mail`);
    setNotice(id, { kind: "ok", text: "Mail gönderiliyor..." });
    try {
      const res = await fetch("/api/admin/event-reports/email/", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: id, email, commission_rate: value }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setNotice(id, { kind: "err", text: json.error || "Mail gönderilemedi." });
        return;
      }
      setSavedRates((current) => ({ ...current, [id]: value }));
      setNotice(id, { kind: "ok", text: `Mail gönderildi: ${email}` });
    } catch (err) {
      console.error("event-reports email error:", err);
      setNotice(id, { kind: "err", text: "Mail gönderilemedi." });
    } finally {
      setBusy(null);
    }
  }

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr");
    if (!needle) return events;
    return events.filter((row) =>
      [row.title, row.venue, shortDate(row.date)].join(" ").toLocaleLowerCase("tr").includes(needle)
    );
  }, [events, search]);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold text-slate-900">Etkinlik Raporları (Veranstaltungsabrechnung)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Her etkinlik için mutabakat raporu: PDF indir veya e-posta ile gönder. Komisyon oranı boş
          bırakılırsa komisyon hesaplanmaz (kendi etkinliğimiz). Yalnız tamamlanmış siparişler sayılır;
          deneme (test) ve iptal edilen siparişler her zaman hariçtir.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <label className="relative flex-1 min-w-[240px] text-sm text-slate-600">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Etkinlik, mekân veya tarih ara"
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900"
            />
          </label>
          <span className="text-sm text-slate-500">{visible.length} etkinlik</span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md bg-[#DC0B2C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b8091f]"
          >
            Yenile
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Yükleniyor...</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Etkinlik bulunamadı.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="p-3">Etkinlik</th>
                    <th className="p-3 text-right">Bilet</th>
                    <th className="p-3 text-right">Brüt</th>
                    <th className="p-3 text-right">Rechnung</th>
                    <th className="p-3">Komisyon %</th>
                    <th className="p-3">PDF</th>
                    <th className="p-3">E-posta gönder</th>
                    <th className="p-3">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const notice = notices[row.id];
                    const saving = busy === `${row.id}:save`;
                    const working = busy?.startsWith(`${row.id}:`);
                    return (
                      <tr key={row.id} className="border-b border-slate-100 align-top">
                        <td className="p-3">
                          <div className="font-medium text-slate-900">{row.title}</div>
                          <div className="text-xs text-slate-500">
                            {shortDate(row.date)}
                            {row.time ? `, ${row.time}` : ""}
                            {row.venue ? ` · ${row.venue}` : ""}
                          </div>
                        </td>
                        <td className="p-3 text-right text-slate-700">{row.tickets}</td>
                        <td className="p-3 text-right font-semibold text-slate-900">
                          {money(row.gross, row.currency)}
                        </td>
                        <td className="p-3 text-right text-slate-700">{row.invoices}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <input
                              inputMode="decimal"
                              value={rates[row.id] ?? ""}
                              onChange={(event) =>
                                setRates((current) => ({ ...current, [row.id]: event.target.value }))
                              }
                              onBlur={() => void commitRate(row.id)}
                              placeholder="—"
                              aria-label={`Komisyon oranı: ${row.title}`}
                              className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm text-slate-900"
                            />
                            <span className="text-slate-500">%</span>
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400">
                            {saving
                              ? "Kaydediliyor..."
                              : savedRates[row.id] === null || savedRates[row.id] === undefined
                                ? "Komisyon yok"
                                : `Kayıtlı: %${savedRates[row.id]}`}
                          </div>
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            disabled={Boolean(working)}
                            onClick={() => void downloadPdf(row.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-[#DC0B2C] hover:text-[#DC0B2C] disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {busy === `${row.id}:pdf` ? "Hazırlanıyor..." : "PDF"}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-1">
                            <input
                              type="email"
                              value={mailTo[row.id] ?? ""}
                              onChange={(event) =>
                                setMailTo((current) => ({ ...current, [row.id]: event.target.value }))
                              }
                              placeholder="ornek@firma.de"
                              aria-label={`E-posta adresi: ${row.title}`}
                              className="w-44 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900"
                            />
                            <button
                              type="button"
                              disabled={Boolean(working)}
                              onClick={() => void sendMail(row.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              {busy === `${row.id}:mail` ? "Gönderiliyor..." : "Gönder"}
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          {notice ? (
                            <span
                              className={`text-xs ${notice.kind === "ok" ? "text-green-700" : "text-red-700"}`}
                            >
                              {notice.text}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EventReportsPage() {
  return (
    <AdminOnlyGuard>
      <EventReportsContent />
    </AdminOnlyGuard>
  );
}
