"use client";

import { useState } from "react";
import { Search, User, Ticket, Calendar, Mail, Phone } from "lucide-react";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { supabase } from "@/lib/supabase-client";

type OrderRow = {
  id: string;
  event_id: string;
  ticket_id: string | null;
  quantity: number;
  total_price: number;
  ticket_code?: string;
  status: string;
  buyer_name?: string;
  buyer_email?: string;
  created_at: string;
  events?: { title?: string; date?: string; time?: string; venue?: string } | null;
  tickets?: { name?: string; type?: string; price?: number } | null;
};

type Profile = {
  kundennummer?: string;
  anrede?: string;
  first_name?: string;
  last_name?: string;
  firma?: string;
  address?: string;
  plz?: string;
  city?: string;
  email?: string;
  telefon?: string;
  handynummer?: string;
};

type Result = {
  profile: Profile;
  authInfo?: { email?: string; created_at?: string; last_sign_in_at?: string };
  orders: OrderRow[];
};

export default function MusteriAraPage() {
  const [kundennummer, setKundennummer] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!kundennummer.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `/api/admin/customer-by-kundennummer?kundennummer=${encodeURIComponent(kundennummer.trim())}`,
        { headers: { Authorization: `Bearer ${session?.access_token || ""}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Müşteri bulunamadı");
        return;
      }
      setResult(data);
    } catch (err) {
      setError("Bir hata oluştu");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(s?: string) {
    if (!s) return "—";
    try {
      return new Date(s).toLocaleString("tr-TR");
    } catch {
      return s;
    }
  }

  return (
    <AdminOnlyGuard>
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Müşteri Ara (Kundennummer)</h1>
          <p className="text-slate-600 mb-6">
            Müşteri numarası ile profil bilgilerini, giriş geçmişini ve siparişlerini görüntüleyin.
          </p>

          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={kundennummer}
                  onChange={(e) => setKundennummer(e.target.value)}
                  placeholder="Kundennummer girin (örn: 20250301AB7F3E)"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? "Aranıyor..." : "Ara"}
              </button>
            </div>
          </form>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Profil */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profil Bilgileri
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Kundennummer:</span>
                    <span className="ml-2 font-medium">{result.profile.kundennummer || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Ad Soyad:</span>
                    <span className="ml-2">
                      {[result.profile.anrede, result.profile.first_name, result.profile.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">E-posta:</span>
                    <span className="ml-2">{result.profile.email || result.authInfo?.email || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Telefon:</span>
                    <span className="ml-2">{result.profile.telefon || result.profile.handynummer || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Adres:</span>
                    <span className="ml-2">
                      {[result.profile.address, result.profile.plz, result.profile.city]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Firma:</span>
                    <span className="ml-2">{result.profile.firma || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Giriş bilgisi */}
              {result.authInfo && (
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Hesap Bilgileri
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Kayıt tarihi:</span>
                      <span className="ml-2">{formatDate(result.authInfo.created_at)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Son giriş:</span>
                      <span className="ml-2">{formatDate(result.authInfo.last_sign_in_at)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Siparişler */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  Siparişler ({result.orders.length})
                </h2>
                {result.orders.length === 0 ? (
                  <p className="text-slate-500">Henüz sipariş yok.</p>
                ) : (
                  <div className="space-y-3">
                    {result.orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border border-slate-100 hover:bg-slate-50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900">{order.events?.title || "—"}</p>
                          <p className="text-sm text-slate-500">
                            {order.events?.date && order.events?.time
                              ? `${order.events.date} ${order.events.time}`
                              : order.events?.date || "—"}
                            {order.events?.venue && ` • ${order.events.venue}`}
                          </p>
                          {order.ticket_code && (
                            <p className="text-xs text-slate-400 mt-1">Bilet: {order.ticket_code}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-slate-600">
                            {order.tickets?.name || "Bilet"} × {order.quantity}
                          </span>
                          <span className="font-medium">€{Number(order.total_price).toFixed(2)}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              order.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : order.status === "cancelled"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {order.status}
                          </span>
                          <span className="text-slate-500">{formatDate(order.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminOnlyGuard>
  );
}
