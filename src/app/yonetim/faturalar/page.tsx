"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, ReceiptText, X } from "lucide-react";

import OrganizerOrAdminGuard from "@/components/OrganizerOrAdminGuard";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

type InvoiceParty = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  email?: string | null;
  vat_id?: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  order_id: string;
  event_id: string;
  issued_at: string;
  currency: string;
  gross_total: number;
  net_total: number;
  tax_total: number;
  tax_rate: number;
  tax_category: "S" | "E";
  seller_snapshot: InvoiceParty;
  buyer_snapshot: InvoiceParty;
  payment_method?: string | null;
  status: "issued" | "cancelled";
  storno_reason?: string | null;
};

type UninvoicedOrder = {
  id: string;
  event_id: string;
  created_at: string;
  buyer_name?: string | null;
  buyer_email?: string | null;
  quantity: number;
  total_price: number;
  sales_channel?: string | null;
  door_payment?: string | null;
};

function money(value: number, currency = "EUR"): string {
  const symbol = currency === "EUR" ? "€" : currency;
  return `${Number(value ?? 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${symbol}`;
}

function dayDe(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("de-DE");
}

function FaturalarContent() {
  const { accessToken, loading: authLoading } = useSimpleAuth();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [missing, setMissing] = useState<UninvoicedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");

  const headers = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken]
  );

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const base = "/api/invoices/";
      const query = new URLSearchParams();
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      if (status) query.set("status", status);

      const [listRes, missingRes] = await Promise.all([
        fetch(`${base}?${query.toString()}`, { cache: "no-store", headers }),
        fetch(`${base}?missing=1&limit=20`, { cache: "no-store", headers }),
      ]);

      if (!listRes.ok) {
        const body = await listRes.json().catch(() => ({}));
        setError(
          String((body as { message?: string }).message || "Faturalar yüklenemedi.") +
            (listRes.status === 401 ? " (Oturum: sayfayı yenileyip tekrar giriş yapın.)" : "")
        );
        setInvoices([]);
        return;
      }
      const listJson = (await listRes.json()) as { invoices?: InvoiceRow[] };
      setInvoices(Array.isArray(listJson.invoices) ? listJson.invoices : []);

      if (missingRes.ok) {
        const missingJson = (await missingRes.json()) as { orders?: UninvoicedOrder[] };
        setMissing(Array.isArray(missingJson.orders) ? missingJson.orders : []);
      } else {
        setMissing([]);
      }
    } catch (err) {
      console.error("faturalar load error:", err);
      setError("Faturalar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, headers, from, to, status]);

  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) {
      setLoading(false);
      setError("Oturum gerekli. Yönetim için tekrar giriş yapın.");
      return;
    }
    void load();
  }, [authLoading, accessToken, load]);

  async function issueInvoice(orderId: string) {
    if (!accessToken) return;
    setBusy(orderId);
    setError(null);
    try {
      const res = await fetch("/api/invoices/issue/", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string; code?: string };
      if (!res.ok) {
        const hint =
          json.code === "seller_incomplete"
            ? " Satıcı bilgileri /yonetim/bilgilerim ekranından tamamlanmalı."
            : "";
        setError(String(json.message || "Fatura kesilemedi.") + hint);
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function storno(invoice: InvoiceRow) {
    if (!accessToken) return;
    const reason = window.prompt(
      `Rechnung ${invoice.invoice_number} storniert werden. Gerekçe (belgede görünür):`,
      "Bilet iade edildi"
    );
    if (reason === null) return;
    setBusy(invoice.id);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/cancel/`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(String(json.message || "Fatura iptal edilemedi."));
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  const totals = useMemo(() => {
    const issued = invoices.filter((row) => row.status === "issued");
    return {
      count: issued.length,
      cancelled: invoices.length - issued.length,
      gross: issued.reduce((sum, row) => sum + Number(row.gross_total || 0), 0),
      tax: issued.reduce((sum, row) => sum + Number(row.tax_total || 0), 0),
      net: issued.reduce((sum, row) => sum + Number(row.net_total || 0), 0),
    };
  }, [invoices]);

  return (
    <div className="p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-bold text-slate-900">Faturalar (Rechnungen)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Belgede satıcı <strong>organizatördür</strong>, platform aracılık eder. KDV oranı
          etkinlikte tutulur: konser %7, diğerleri %19, <em>§ 19 UStG</em> organizatörlerde %0.
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Faturalar", String(totals.count)],
            ["Net toplam", money(totals.net)],
            ["Umsatzsteuer", money(totals.tax)],
            ["Brüt toplam", money(totals.gross)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-medium text-slate-600">{label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <label className="text-sm text-slate-600">
            Başlangıç
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600">
            Bitiş
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600">
            Durum
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 block rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="">Tümü</option>
              <option value="issued">Kesilmiş</option>
              <option value="cancelled">Storno</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md bg-[#DC0B2C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b8091f]"
          >
            Yenile
          </button>
          {totals.cancelled > 0 && (
            <span className="text-sm text-slate-500">{totals.cancelled} Storno kayıtlı</span>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-900">Kesilen faturalar</h2>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Yükleniyor...</p>
          ) : invoices.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">
              Henüz fatura kesilmemiş. Aşağıdaki faturasız siparişlerden kesebilirsin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="p-3">Rechnung-Nr.</th>
                    <th className="p-3">Tarih</th>
                    <th className="p-3">Alıcı</th>
                    <th className="p-3">Satıcı (Veranstalter)</th>
                    <th className="p-3 text-right">Net</th>
                    <th className="p-3 text-right">USt</th>
                    <th className="p-3 text-right">Brüt</th>
                    <th className="p-3">Durum</th>
                    <th className="p-3">Belge</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 align-top">
                      <td className="p-3 font-mono text-xs text-slate-900">{row.invoice_number}</td>
                      <td className="p-3 text-slate-700">{dayDe(row.issued_at)}</td>
                      <td className="p-3 text-slate-700">
                        {row.buyer_snapshot.name || "-"}
                        {row.buyer_snapshot.email ? (
                          <div className="text-xs text-slate-400">{row.buyer_snapshot.email}</div>
                        ) : null}
                      </td>
                      <td className="p-3 text-slate-700">
                        {row.seller_snapshot.name || "-"}
                        {row.seller_snapshot.vat_id ? (
                          <div className="text-xs text-slate-400">USt-IdNr. {row.seller_snapshot.vat_id}</div>
                        ) : null}
                      </td>
                      <td className="p-3 text-right text-slate-700">{money(row.net_total, row.currency)}</td>
                      <td className="p-3 text-right text-slate-700">
                        {money(row.tax_total, row.currency)}
                        <div className="text-xs text-slate-400">
                          {row.tax_category === "E" ? "§ 19 UStG" : `%${String(row.tax_rate).replace(".", ",")}`}
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold text-slate-900">
                        {money(row.gross_total, row.currency)}
                      </td>
                      <td className="p-3">
                        {row.status === "issued" ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                            Kesilmiş
                          </span>
                        ) : (
                          <span
                            className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
                            title={row.storno_reason || undefined}
                          >
                            Storno
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/api/orders/${row.order_id}/invoice/?format=pdf`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:border-[#DC0B2C] hover:text-[#DC0B2C]"
                          >
                            <FileText className="h-3.5 w-3.5" /> PDF
                          </a>
                          <a
                            href={`/api/orders/${row.order_id}/invoice/?format=xrechnung`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:border-[#DC0B2C] hover:text-[#DC0B2C]"
                            title="ZUGFeRD / Factur-X EN16931 XML"
                          >
                            <ReceiptText className="h-3.5 w-3.5" /> XML
                          </a>
                          {row.status === "issued" && (
                            <button
                              type="button"
                              disabled={busy === row.id}
                              onClick={() => void storno(row)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-[#DC0B2C] disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" /> Storno
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-900">Faturasız siparişler</h2>
            <p className="text-xs text-slate-500">
              Tamamlanmış ve henüz Rechnung kesilmemiş son siparişler.
            </p>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Yükleniyor...</p>
          ) : missing.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Faturasız sipariş yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="p-3">Tarih</th>
                    <th className="p-3">Alıcı</th>
                    <th className="p-3">Kanal</th>
                    <th className="p-3 text-right">Adet</th>
                    <th className="p-3 text-right">Tutar</th>
                    <th className="p-3">Rechnung</th>
                  </tr>
                </thead>
                <tbody>
                  {missing.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100">
                      <td className="p-3 text-slate-700">{dayDe(order.created_at)}</td>
                      <td className="p-3 text-slate-700">
                        {order.buyer_name || order.buyer_email || "Gast (gişe)"}
                      </td>
                      <td className="p-3 text-slate-500">
                        {order.sales_channel === "door"
                          ? order.door_payment === "cash"
                            ? "Kapı / nakit"
                            : "Kapı / kart"
                          : "Çevrimiçi"}
                      </td>
                      <td className="p-3 text-right text-slate-700">{order.quantity}</td>
                      <td className="p-3 text-right font-semibold text-slate-900">
                        {money(order.total_price)}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          disabled={busy === order.id}
                          onClick={() => void issueInvoice(order.id)}
                          className="rounded-md border border-[#DC0B2C] px-3 py-1 text-xs font-semibold text-[#DC0B2C] hover:bg-[#DC0B2C] hover:text-white disabled:opacity-50"
                        >
                          {busy === order.id ? "Kesiliyor..." : "Fatura kes"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FaturalarPage() {
  return (
    <OrganizerOrAdminGuard>
      <FaturalarContent />
    </OrganizerOrAdminGuard>
  );
}
