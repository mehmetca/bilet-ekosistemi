"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Loader2, Plus, Ticket, X } from "lucide-react";
import AdminOnlyGuard from "@/components/AdminOnlyGuard";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { doorPickerFromDate } from "@/lib/door-picker";

type EventOption = {
  id: string;
  title?: string | null;
  date?: string | null;
};

type GateAssignmentRow = { gate_sales_user_id: string; event_id: string };

type AdminUserRow = {
  user_id: string;
  email?: string | null;
  full_name?: string | null;
  roles: string[];
};

function authHeaders(accessToken: string, json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function eventLabel(ev: EventOption): string {
  const date = ev.date ? String(ev.date).slice(0, 10) : "";
  return `${date ? `${date} — ` : ""}${ev.title || "Etkinlik"}`;
}

function GateAssignmentsContent() {
  const { accessToken } = useSimpleAuth();

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [assignments, setAssignments] = useState<GateAssignmentRow[]>([]);
  const [allEvents, setAllEvents] = useState<EventOption[]>([]);
  const [sellableEvents, setSellableEvents] = useState<EventOption[]>([]);
  const [tableReady, setTableReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [newEventIds, setNewEventIds] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const [usersRes, eventsRes] = await Promise.all([
        fetch("/api/admin/users", {
          headers: authHeaders(accessToken),
          cache: "no-store",
        }).then((r) => r.json()),
        fetch(`/api/staff-events?sellable=1&from=${doorPickerFromDate()}`, {
          headers: authHeaders(accessToken),
          cache: "no-store",
        }).then((r) => r.json()),
      ]);
      if (usersRes?.error) {
        setError(usersRes.error);
      } else {
        setUsers((usersRes?.users || []) as AdminUserRow[]);
        setAssignments((usersRes?.gateAssignments || []) as GateAssignmentRow[]);
        setAllEvents((usersRes?.events || []) as EventOption[]);
        setTableReady(usersRes?.gateAssignmentTableReady !== false);
        setError(null);
      }
      setSellableEvents((eventsRes?.events || []) as EventOption[]);
    } catch {
      setError("Gişe görevlileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const gateUsers = useMemo(
    () => users.filter((u) => Array.isArray(u.roles) && u.roles.includes("gate_sales")),
    [users]
  );
  const eventById = useMemo(() => new Map(allEvents.map((ev) => [ev.id, ev])), [allEvents]);

  const post = async (payload: Record<string, unknown>) => {
    if (!accessToken) return null;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        mailSent?: boolean;
        passwordGenerated?: boolean;
      } | null;
      if (!res.ok || data?.error) {
        setError(data?.error || `İşlem başarısız (HTTP ${res.status}).`);
        return null;
      }
      await load();
      return data;
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (userId: string) => {
    setEditingId(userId);
    setDraft(assignments.filter((row) => row.gate_sales_user_id === userId).map((row) => row.event_id));
  };

  const saveAssignments = async (userId: string) => {
    const res = await post({ action: "assignGateEvents", userId, eventIds: draft });
    if (res) setEditingId(null);
  };

  const createGateUser = async () => {
    const [first, ...rest] = fullName.trim().split(/\s+/);
    const res = await post({
      action: "createGateSales",
      firstName: first || "",
      lastName: rest.join(" "),
      email: email.trim(),
      phone: phone.trim(),
      password: password,
      eventIds: newEventIds,
    });
    if (res) {
      setNote(
        res.mailSent
          ? "Hesap açıldı; giriş bağlantısı ve şifre görevlinin e-postasına gönderildi."
          : "Hesap açıldı fakat giriş maili gitmedi; şifreyi görevliyle kendin paylaşmalısın."
      );
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setNewEventIds([]);
    }
  };

  const removeGateRole = async (userId: string) => {
    await post({ action: "removeRole", userId, role: "gate_sales" });
  };

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-ink-900">Gişe görevlendirmeleri</h1>
        <p className="text-sm text-ink-600">
          Kapıda bilet kesme yetkisi yalnız burada verilir. Görevli sadece atandığı etkinliği görür;
          etkinlik geçince görevi kendiliğinden biter.
        </p>
      </div>

      {!tableReady ? (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-gold-500 bg-gold-50 p-3 text-sm text-gold-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Görevlendirme tablosu canlıda henüz uygulanmamış (migration 148). Atamalar kaydedilemez.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <section className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-ink-900">Gişe görevlileri</h2>
          {loading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-ink-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
            </div>
          ) : gateUsers.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">Henüz gişe görevlisi yok.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {gateUsers.map((u) => {
                const own = assignments.filter((row) => row.gate_sales_user_id === u.user_id);
                const active = own.filter((row) =>
                  sellableEvents.some((ev) => ev.id === row.event_id)
                );
                const finished = own.filter((row) =>
                  !sellableEvents.some((ev) => ev.id === row.event_id)
                );
                const editing = editingId === u.user_id;
                return (
                  <li key={u.user_id} className="rounded-lg border border-ink-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink-900">
                          {u.full_name || "Gişe görevlisi"}
                        </p>
                        <p className="truncate text-xs text-ink-500">{u.email || "—"} · /gise</p>
                      </div>
                      <div className="flex gap-2">
                        {editing ? null : (
                          <button
                            type="button"
                            onClick={() => startEdit(u.user_id)}
                            disabled={busy || !tableReady}
                            className="min-h-[36px] rounded-lg border border-ink-300 px-3 text-sm hover:bg-ink-50 disabled:opacity-50"
                          >
                            Etkinlik ata
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void removeGateRole(u.user_id)}
                          disabled={busy || !tableReady}
                          className="flex min-h-[36px] items-center gap-1 rounded-lg border border-ink-300 px-3 text-sm text-gold-700 hover:bg-gold-50 disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" /> Yetkiyi kaldır
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                      {active.length === 0 && finished.length === 0 ? (
                        <span className="text-ink-500">Etkinlik atanmamış.</span>
                      ) : null}
                      {active.map((row) => (
                        <span
                          key={row.event_id}
                          className="rounded bg-ink-100 px-2 py-1 text-ink-800"
                        >
                          {eventLabel(eventById.get(row.event_id) || { id: row.event_id })}
                        </span>
                      ))}
                      {finished.map((row) => (
                        <span
                          key={row.event_id}
                          className="rounded bg-ink-50 px-2 py-1 text-ink-400 line-through"
                          title="Etkinlik geçti; görev otomatik kapandı."
                        >
                          {eventLabel(eventById.get(row.event_id) || { id: row.event_id })}
                        </span>
                      ))}
                    </div>

                    {editing ? (
                      <div className="mt-3 border-t border-ink-200 pt-3">
                        {sellableEvents.length === 0 ? (
                          <p className="text-sm text-ink-500">
                            Satılabilir bileti olan yaklaşan etkinlik yok.
                          </p>
                        ) : (
                          <label className="block space-y-1">
                            {sellableEvents.map((ev) => (
                              <label key={ev.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={draft.includes(ev.id)}
                                  onChange={() => setDraft((prev) => toggle(prev, ev.id))}
                                  className="h-4 w-4"
                                />
                                {eventLabel(ev)}
                              </label>
                            ))}
                          </label>
                        )}
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveAssignments(u.user_id)}
                            disabled={busy}
                            className="flex min-h-[36px] items-center gap-1 rounded-lg bg-gold-500 px-3 text-sm font-semibold text-white hover:bg-gold-600 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" /> Kaydet
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="min-h-[36px] rounded-lg border border-ink-300 px-3 text-sm hover:bg-ink-50"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {error ? (
            <p className="mt-3 flex items-start gap-2 text-sm text-gold-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          ) : null}
        </section>

        <section className="h-fit rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-ink-900">
            <Ticket className="h-4 w-4" /> Yeni gişe görevlisi
          </h2>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ad Soyad"
            className="mt-3 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-posta"
            type="email"
            className="mt-2 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefon (isteğe bağlı)"
            className="mt-2 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
          />
          <label className="mt-2 block text-sm">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="İlk şifre (opsiyonel, en az 8 karakter)"
              type="password"
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
            />
          </label>
          <p className="mt-2 text-xs text-ink-500">
            Boş bırakırsan şifre sistem tarafından üretilir ve yalnız giriş mailinde gönderilir; mail
            gitmezse hesap geri alınır.
          </p>

          <h3 className="mt-4 text-xs font-semibold text-ink-600">Görevli olacağı etkinlikler</h3>
          {loading ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-ink-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Etkinlikler yükleniyor…
            </div>
          ) : sellableEvents.length === 0 ? (
            <p className="mt-1 text-sm text-ink-500">Uygun etkinlik yok.</p>
          ) : (
            <div className="mt-1 max-h-52 space-y-1 overflow-auto">
              {sellableEvents.map((ev) => (
                <label key={ev.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newEventIds.includes(ev.id)}
                    onChange={() => setNewEventIds((prev) => toggle(prev, ev.id))}
                    className="h-4 w-4"
                  />
                  {eventLabel(ev)}
                </label>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => void createGateUser()}
            disabled={
              busy ||
              !tableReady ||
              !fullName.trim() ||
              !email.trim() ||
              (password.length > 0 && password.length < 8) ||
              newEventIds.length === 0
            }
            className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-gold-500 px-4 text-sm font-bold text-white hover:bg-gold-600 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Hesabı aç ve görevlendir
          </button>
          {note ? (
            <p className="mt-2 flex items-start gap-2 text-xs text-ink-600">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {note}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default function GiseGorevlendirmeleriPage() {
  return (
    <AdminOnlyGuard>
      <GateAssignmentsContent />
    </AdminOnlyGuard>
  );
}
