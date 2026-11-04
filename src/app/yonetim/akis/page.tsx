"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CreditCard,
  Ticket,
  Mail,
  FileText,
  UserPlus,
  Building2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

type ActivityKind =
  | "order"
  | "door"
  | "checkin"
  | "mail"
  | "invoice"
  | "user"
  | "organizer"
  | "controller"
  | "admin";

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  at: string;
  title: string;
  detail?: string | null;
  amount?: number | null;
  eventId?: string | null;
  isTest?: boolean;
};

const KIND_META: Record<ActivityKind, { label: string; icon: typeof Activity; color: string }> = {
  order: { label: "Sipariş", icon: CreditCard, color: "bg-blue-100 text-blue-700" },
  door: { label: "Gişe", icon: Ticket, color: "bg-emerald-100 text-emerald-700" },
  checkin: { label: "Giriş", icon: ShieldCheck, color: "bg-teal-100 text-teal-700" },
  mail: { label: "Mail", icon: Mail, color: "bg-indigo-100 text-indigo-700" },
  invoice: { label: "Fatura", icon: FileText, color: "bg-amber-100 text-amber-700" },
  user: { label: "Üye", icon: UserPlus, color: "bg-slate-100 text-slate-700" },
  organizer: { label: "Organizatör", icon: Building2, color: "bg-purple-100 text-purple-700" },
  controller: { label: "Kontrolör", icon: ShieldCheck, color: "bg-cyan-100 text-cyan-700" },
  admin: { label: "Yönetici", icon: ShieldCheck, color: "bg-rose-100 text-rose-700" },
};

const FILTERS: Array<{ key: ActivityKind | "all"; label: string }> = [
  { key: "all", label: "Tümü" },
  { key: "order", label: "Sipariş" },
  { key: "door", label: "Gişe" },
  { key: "invoice", label: "Fatura" },
  { key: "mail", label: "Mail" },
  { key: "user", label: "Üye" },
  { key: "organizer", label: "Organizatör" },
  { key: "admin", label: "Yönetici" },
];

function formatWhen(value: string) {
  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return value;
  }
}

const money = (value: number) =>
  `€${Number(value || 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function ActivityPage() {
  return (
    <AdminOnlyGuard>
      <ActivityContent />
    </AdminOnlyGuard>
  );
}

function ActivityContent() {
  const { accessToken } = useSimpleAuth();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<ActivityKind | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setError("");
      const res = await fetch("/api/admin/activity", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: ActivityItem[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Akış okunamadı.");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setUpdatedAt(new Date().toLocaleTimeString("tr-TR"));
    } catch {
      setError("Akış okunamadı.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.kind === filter)),
    [items, filter]
  );

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Canlı akış</h1>
            <p className="text-slate-600">
              Sitede olan biten tek listede: sipariş, gişe, mail, fatura, üyelik, başvuru ve yönetici
              işlemleri.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Yenile
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          {FILTERS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                filter === entry.key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {entry.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            {updatedAt ? `Son güncelleme ${updatedAt} · 30 sn'de bir yenilenir` : ""}
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Yükleniyor…</div>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Bu filtrede kayıt yok.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((item) => {
                const meta = KIND_META[item.kind];
                const Icon = meta.icon;
                return (
                  <li key={item.id} className="flex items-start gap-3 p-3 hover:bg-slate-50">
                    <span className={`mt-0.5 rounded-lg p-1.5 ${meta.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{item.title}</span>
                        <span className="rounded bg-slate-100 px-1.5 text-[10px] font-medium uppercase text-slate-600">
                          {meta.label}
                        </span>
                        {item.isTest && (
                          <span className="rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">
                            TEST
                          </span>
                        )}
                      </div>
                      {item.detail && (
                        <p className="truncate text-xs text-slate-500">{item.detail}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      {typeof item.amount === "number" && (
                        <span className="text-sm font-semibold text-slate-900">
                          {money(item.amount)}
                        </span>
                      )}
                      <span className="whitespace-nowrap text-xs text-slate-500">
                        {formatWhen(item.at)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
