"use client";

import { useState, useEffect, useCallback } from "react";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Ticket as TicketIcon, ArrowRight, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import type { User } from "@supabase/supabase-js";
import BiletlerimOrderList from "@/components/BiletlerimOrderList";
import type { BiletlerimOrderRow } from "@/components/BiletlerimOrderList";

type OrderRow = BiletlerimOrderRow;

interface BiletlerimSectionProps {
  user: User | null;
}

/** PostgREST bazen FK ilişkisini tek nesne yerine tek elemanlı dizi döndürür. */
function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function BiletlerimSection({ user }: BiletlerimSectionProps) {
  const { accessToken: authAccessToken } = useSimpleAuth();
  const locale = useLocale();
  const t = useTranslations("panel");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [printOrderId, setPrintOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let token = authAccessToken;
      if (!token) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        token = session?.access_token ?? null;
      }
      if (!token) {
        setError(t("sessionNotFound"));
        setLoading(false);
        return;
      }
      const res = await fetch("/api/user/orders", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.status === 401) {
        setError(t("sessionExpired"));
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(t("ordersLoadFailed"));
        setLoading(false);
        return;
      }
      const raw = (await res.json()) as unknown;
      if (!Array.isArray(raw)) {
        setError(t("ordersLoadFailed"));
        setLoading(false);
        return;
      }
      const data: OrderRow[] = raw.map((row) => {
        const o = row as OrderRow;
        return {
          ...o,
          events: normalizeRelation(o.events),
          tickets: normalizeRelation(o.tickets),
        };
      });
      setOrders(data);
    } catch (e) {
      console.error("Biletlerim fetch error:", e);
      setError(t("ordersLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [user, authAccessToken, t]);

  useEffect(() => {
    if (user) fetchOrders();
    else setLoading(false);
  }, [user, fetchOrders]);

  async function handleDelete(orderId: string) {
    if (!window.confirm(t("deleteTicketConfirm"))) return;
    setDeletingId(orderId);
    try {
      let token = authAccessToken;
      if (!token) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        token = session?.access_token ?? null;
      }
      if (!token) return;
      const res = await fetch(`/api/user/orders/${String(orderId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        alert(t("deleteFailed"));
      }
    } catch (e) {
      console.error(e);
      alert(t("deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  function handleTogglePrint(orderId: string) {
    setPrintOrderId((prev) => (prev === orderId ? null : orderId));
  }

  if (!user) return null;

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <TicketIcon className="h-5 w-5" aria-hidden />
        {t("myTickets")}
      </h2>
      {loading ? (
        <div className="text-slate-500 py-8 text-center">{t("loading")}</div>
      ) : error ? (
        <div className="py-6 text-center">
          <p className="text-amber-600 text-sm mb-2">{error}</p>
          <button
            type="button"
            onClick={fetchOrders}
            className="text-primary-600 text-sm font-medium hover:underline"
          >
            {t("retry")}
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" aria-hidden />
          <p className="text-slate-600 font-medium">{t("noTickets")}</p>
          <p className="text-sm text-slate-500 mt-1">{t("noTicketsDesc")}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={fetchOrders}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm font-medium"
            >
              {t("refresh")}
            </button>
            <NextLink
              href={`/${locale}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
            >
              {t("browseEvents")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </NextLink>
          </div>
        </div>
      ) : (
        <BiletlerimOrderList
          orders={orders}
          printOrderId={printOrderId}
          onTogglePrint={handleTogglePrint}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      )}
    </section>
  );
}
