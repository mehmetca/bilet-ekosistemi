"use client";

import { Printer, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import TicketPrint from "@/components/TicketPrint";
import type { EventCurrency } from "@/types/database";
import type { SeatDetail } from "@/types/seat-detail";

export type BiletlerimOrderRow = {
  id: string;
  event_id: string;
  ticket_id: string | null;
  quantity: number;
  total_price: number;
  status: string;
  created_at: string;
  ticket_code?: string;
  buyer_name?: string;
  events?: { title?: string; date?: string; time?: string; venue?: string; location?: string; currency?: string } | null;
  tickets?: { name?: string; type?: string; price?: number } | null;
  seatDetails?: SeatDetail[];
};

type Props = {
  orders: BiletlerimOrderRow[];
  printOrderId: string | null;
  onTogglePrint: (orderId: string) => void;
  onDelete: (orderId: string) => void;
  deletingId: string | null;
};

export default function BiletlerimOrderList({
  orders,
  printOrderId,
  onTogglePrint,
  onDelete,
  deletingId,
}: Props) {
  const t = useTranslations("panel");

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div
          key={order.id}
          className="rounded-lg border border-slate-100 overflow-hidden hover:bg-slate-50"
        >
          <div className="grid grid-cols-1 md:grid-cols-[minmax(280px,1fr)_auto] gap-4 p-4 items-center">
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{order.events?.title || "—"}</p>
              <p className="text-sm text-slate-500 mt-0.5">
                {order.events?.date && order.events?.time
                  ? `${order.events.date} ${order.events.time}`
                  : order.events?.date || "—"}
                {order.events?.venue && ` • ${order.events.venue}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-slate-600">
                {order.tickets?.name || order.tickets?.type || "Bilet"} × {order.quantity}
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
              {order.status === "completed" && order.ticket_code && (
                <button
                  type="button"
                  onClick={() => onTogglePrint(order.id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  {t("printTicket")}
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(order.id)}
                disabled={deletingId === order.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                title={t("deleteTicket")}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {t("deleteTicket")}
              </button>
            </div>
          </div>
          {printOrderId === order.id && order.ticket_code && order.status === "completed" && (
            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <TicketPrint
                ticketCode={order.ticket_code}
                eventTitle={order.events?.title || "—"}
                eventDate={order.events?.date || ""}
                eventTime={order.events?.time || ""}
                venue={order.events?.venue || "—"}
                location={order.events?.location || "—"}
                buyerName={order.buyer_name || "—"}
                quantity={order.quantity}
                ticketType={order.tickets?.name || order.tickets?.type || "Bilet"}
                price={order.total_price}
                currency={(order.events?.currency as EventCurrency) || "EUR"}
                seatDetails={order.seatDetails}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
