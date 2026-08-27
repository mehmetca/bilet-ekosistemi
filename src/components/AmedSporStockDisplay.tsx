"use client";

import { useEffect, useState } from "react";
import { AlertCircle, TrendingDown } from "lucide-react";
import { supabase } from "@/lib/supabase-client";

interface StockDisplayProps {
  eventId: string;
  locale?: string;
}

interface StockInfo {
  remaining: number | null;
  totalCapacity: number | null;
  sold: number;
}

export default function AmedSporStockDisplay({ eventId, locale = "tr" }: StockDisplayProps) {
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchStockInfo() {
      try {
        setLoading(true);

        const { data: event, error: eventError } = await supabase
          .from("events")
          .select("max_tickets")
          .eq("id", eventId)
          .single();

        if (eventError || !event) {
          setStockInfo(null);
          setError(false);
          return;
        }

        const maxTickets = event.max_tickets;

        if (!maxTickets) {
          setStockInfo(null);
          setError(false);
          return;
        }

        const { count, error: countsError } = await supabase
          .from("event_form_responses")
          .select("id", { count: "exact", head: true })
          .eq("event_id", eventId);

        if (countsError) {
          setStockInfo({
            remaining: maxTickets,
            totalCapacity: maxTickets,
            sold: 0,
          });
          setError(false);
          return;
        }

        const sold = count || 0;
        const remaining = Math.max(0, maxTickets - sold);

        setStockInfo({
          remaining,
          totalCapacity: maxTickets,
          sold,
        });
        setError(false);
      } catch (err) {
        console.error("Stok bilgisi hatası:", err);
        setError(true);
        setStockInfo(null);
      } finally {
        setLoading(false);
      }
    }

    fetchStockInfo();
    
    // Her 10 saniyede bir güncelle
    const interval = setInterval(fetchStockInfo, 10000);
    
    return () => clearInterval(interval);
  }, [eventId]);

  if (!loading && (!stockInfo?.remaining || error)) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
      </div>
    );
  }

  if (error || !stockInfo) {
    return null;
  }

  const { remaining, totalCapacity, sold } = stockInfo;
  const percentage = totalCapacity ? Math.round((sold / totalCapacity) * 100) : 0;

  const getSeverityColor = () => {
    if (remaining === 0) return "bg-red-50 border-red-200 text-red-800";
    if (remaining <= 10) return "bg-orange-50 border-orange-200 text-orange-800";
    if (percentage >= 80) return "bg-yellow-50 border-yellow-200 text-yellow-800";
    return "bg-green-50 border-green-200 text-green-800";
  };

  const severityColor = getSeverityColor();

  return (
    <div className={`${severityColor} border rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        {remaining === 0 ? (
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        ) : (
          <TrendingDown className="h-5 w-5 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-1">
            {locale === "tr" ? "Bilet Durumu" : "Ticket Status"}
          </h4>
          <div className="text-2xl font-bold mb-1">
            {remaining === 0
              ? (locale === "tr" ? "Tükendi" : "Sold Out")
              : `${remaining} ${locale === "tr" ? "bilet kaldı" : "tickets remaining"}`}
          </div>
          {totalCapacity && (
            <div className="text-xs opacity-75">
              {locale === "tr" ? "Toplam" : "Total"}: {totalCapacity} | {locale === "tr" ? "Satılan" : "Sold"}: {sold} ({percentage}%)
            </div>
          )}
        </div>
      </div>

      {totalCapacity && (
        <div className="mt-3">
          <div className="w-full bg-black/10 rounded-full h-2">
            <div
              className="bg-current h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
