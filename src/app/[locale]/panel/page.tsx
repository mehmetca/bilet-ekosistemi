"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import PanelLayout from "@/components/PanelLayout";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useTranslations } from "next-intl";
import { Ticket, ArrowRight, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

type OrderRow = {
  id: string;
  event_id: string;
  ticket_id: string | null;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  events?: { title?: string; date?: string; time?: string; venue?: string } | null;
  tickets?: { name?: string; type?: string; price?: number } | null;
};

export default function PanelPage() {
  const t = useTranslations("panel");
  const { user, loading: authLoading } = useSimpleAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/giris");
      return;
    }
    if (!user) return;
    fetchOrders();
    ensureProfile();
  }, [user, authLoading, router]);

  async function ensureProfile() {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${session?.access_token || ""}`,
      };
      const getRes = await fetch("/api/profile", { headers });
      if (!getRes.ok) return;
      const existing = (await getRes.json()) as { kundennummer?: string } | null;
      if (existing?.kundennummer) return;
      headers["Content-Type"] = "application/json";
      await fetch("/api/profile", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: user.email }),
      });
    } catch (e) {
      console.error("ensureProfile:", e);
    }
  }

  async function fetchOrders() {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/user/orders", {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      if (res.ok) {
        const data = (await res.json()) as OrderRow[];
        setOrders(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || (!user && loading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">{t("loading")}</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <PanelLayout>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{t("title")}</h1>
        <p className="text-slate-600 mb-8">
          {t("welcome")}, {user.email}
        </p>

        {/* Biletlerim / Katıldığım Etkinlikler */}
        <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            {t("myTickets")}
          </h2>
          {loading ? (
            <div className="text-slate-500 py-8 text-center">{t("loading")}</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">{t("noTickets")}</p>
              <p className="text-sm text-slate-500 mt-1">{t("noTicketsDesc")}</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
              >
                {t("browseEvents")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border border-slate-100 hover:bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">
                      {order.events?.title || "—"}
                    </p>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {order.events?.date && order.events?.time
                        ? `${order.events.date} ${order.events.time}`
                        : order.events?.date || "—"}
                      {order.events?.venue && ` • ${order.events.venue}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-600">
                      {order.tickets?.name || "Bilet"} × {order.quantity}
                    </span>
                    <span className="font-medium text-slate-900">
                      €{Number(order.total_price).toFixed(2)}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        order.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : order.status === "cancelled"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {order.status === "completed"
                        ? t("completed")
                        : order.status === "cancelled"
                        ? t("cancelled")
                        : t("pending")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PanelLayout>
  );
}
