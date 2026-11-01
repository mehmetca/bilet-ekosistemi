"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Armchair, BadgePercent, FileDown, Loader2, Ticket, Undo2 } from "lucide-react";
import { doorPickerFromDate } from "@/lib/door-picker";
import { supabase } from "@/lib/supabase-client";
import DoorHallPicker, {
  type HallRow,
  type HallSeat,
  type HallSeatGroup,
  type HallSection,
} from "@/components/DoorHallPicker";

type StaffEvent = {
  id: string;
  title?: string | null;
  date?: string | null;
  time?: string | null;
  venue?: string | null;
  seating_plan_id?: string | null;
};

type SelectedSeat = {
  id: string;
  seat_label: string;
  row_label: string;
  section_name: string;
  ticket_id: string;
  ticket_name: string;
  price: number;
};

type TicketRow = {
  id: string;
  name?: string | null;
  ticket_type?: string | null;
  price?: number | null;
  available?: number | null;
  quantity?: number | null;
};

type SaleRow = {
  id: string;
  ticket_code?: string | null;
  ticket_name?: string | null;
  event_title?: string | null;
  quantity?: number | null;
  total_price?: number | null;
  status?: string | null;
  door_payment?: string | null;
  door_note?: string | null;
  seller_name?: string | null;
  buyer_name?: string | null;
  created_at?: string | null;
};

type SellerTotal = {
  name: string;
  orders: number;
  tickets: number;
  gross: number;
};

type PaymentKind = "cash" | "card" | "free";

const PAYMENT_LABEL: Record<PaymentKind, string> = {
  cash: "Nakit",
  card: "Kart (POS)",
  free: "Davetiye",
};

const DOOR_PAYMENT_TEXT: Record<string, string> = {
  cash: "Nakit",
  card: "Kart",
  free: "Davetiye",
};

type CashSummary = {
  cash_total: number;
  card_total: number;
  tickets: number;
  orders: number;
  free_tickets: number;
  cancelled: number;
};

type CashSessionRow = {
  id: string;
  staff_id: string;
  staff_name?: string | null;
  status: string;
  opening_amount: number;
  opened_at?: string | null;
  closed_at?: string | null;
  counted_cash?: number | null;
  expected_cash?: number | null;
  difference?: number | null;
  summary?: CashSummary | null;
};

type CashState = {
  isAdmin?: boolean;
  openSession?: CashSessionRow | null;
  sessions?: CashSessionRow[];
};

type SaleResult = {
  orderId: string;
  orderNumber?: string;
  ticketCodes: string[];
  seatDetails?: { section_name: string; row_label: string; seat_label: string; ticket_code: string }[];
  quantity: number;
  totalPrice: number;
  currency: string;
  payment: string;
  emailSent: boolean;
  emailReason?: string | null;
};

type SaleResultCard = SaleResult & { groupLabel: string };

const money = (value: number, currency = "EUR") =>
  `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const signedMoney = (value: number, currency = "EUR") =>
  `${value > 0 ? "+" : value < 0 ? "-" : ""}${money(Math.abs(value), currency)}`;

const stamp = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function localDayRange(day: string) {
  const from = new Date(`${day}T00:00:00`);
  const to = new Date(`${day}T23:59:59.999`);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function withAuth(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Oturum yok");
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

/**
 * Kapıda bilet kesme (mode=sell) ve gün kaydını izleme (mode=observe) paneli.
 * Rol kapıları çağıran sayfada; panel yalnız veri ister.
 */
export default function DoorSalePanel({ mode }: { mode: "sell" | "observe" }) {
  const canSell = mode === "sell";

  const [events, setEvents] = useState<StaffEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [ticketId, setTicketId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [payment, setPayment] = useState<PaymentKind>("cash");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [note, setNote] = useState("");

  const [seatMode, setSeatMode] = useState(false);
  // Salon penceresi her açılışta sıfırlanır: görevli aynı salonda ızgarayı yeniden kurar.
  const [hallKey, setHallKey] = useState(0);
  const [hallOpen, setHallOpen] = useState(false);
  const [seatSections, setSeatSections] = useState<HallSection[]>([]);
  const [seatLoading, setSeatLoading] = useState(false);
  const [seatError, setSeatError] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<SelectedSeat[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SaleResultCard[]>([]);

  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [totals, setTotals] = useState<{
    cash: number;
    card: number;
    gross: number;
    orders: number;
    tickets: number;
    free: number;
    cancelled: number;
  } | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [bySeller, setBySeller] = useState<SellerTotal[]>([]);

  const [cash, setCash] = useState<CashState | null>(null);
  const [cashSessions, setCashSessions] = useState<CashSessionRow[]>([]);
  const [openingAmount, setOpeningAmount] = useState("100");
  const [countedCash, setCountedCash] = useState("");
  const [closing, setClosing] = useState(false);
  const [shiftResult, setShiftResult] = useState<{ expectedCash: number; difference: number } | null>(null);
  const [cashBusy, setCashBusy] = useState(false);

  const cancelRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await withAuth(`/api/staff-events?sellable=1&from=${doorPickerFromDate()}`).catch(
        () => null
      );
      if (!res || !res.ok || cancelled) return;
      const data = (await res.json().catch(() => null)) as { events?: StaffEvent[] } | null;
      const rows = Array.isArray(data?.events) ? data.events : [];
      setEvents(rows);
      // Tek etkinliğe görevlendirilmiş gişe görevlisi seçim yapmaz.
      if (canSell && rows.length === 1) setEventId(String(rows[0].id));
    })();
    return () => {
      cancelled = true;
    };
  }, [canSell]);

  useEffect(() => {
    setTickets([]);
    setTicketId("");
    setSeatMode(false);
    setHallOpen(false);
    setSeatSections([]);
    setSelectedSeats([]);
    setSeatError(null);
    if (!eventId) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/event-tickets?event_id=${encodeURIComponent(eventId)}`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as { tickets?: TicketRow[] } | null;
      if (cancelled || !res.ok) return;
      const rows = Array.isArray(data?.tickets) ? data.tickets : [];
      setTickets(rows);
      const first = rows.find((t) => Number(t.available ?? 0) > 0);
      setTicketId(first ? String(first.id) : String(rows[0]?.id || ""));
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const loadSeatGrid = useCallback(async () => {
    if (!eventId) return;
    setSeatLoading(true);
    setSeatError(null);
    const res = await withAuth(
      `/api/door-seats?event_id=${encodeURIComponent(eventId)}`
    ).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { success?: boolean; message?: string; hasPlan?: boolean; sections?: HallSection[] }
      | null;
    setSeatLoading(false);
    if (!res?.ok || data?.success !== true) {
      setSeatSections([]);
      setSeatError(data?.message || "Salon planı okunamadı.");
      return;
    }
    setSeatSections(Array.isArray(data?.sections) ? data.sections : []);
  }, [eventId]);

  useEffect(() => {
    setSelectedSeats([]);
    if (!seatMode || !eventId) {
      setSeatSections([]);
      return;
    }
    void loadSeatGrid();
  }, [seatMode, eventId, loadSeatGrid]);

  const toggleSeat = (seat: HallSeat, row: HallRow, sectionName: string) => {
    if (seat.status !== "free" || !row.ticket_id) return;
    setSelectedSeats((prev) => {
      if (prev.some((s) => s.id === seat.id)) return prev.filter((s) => s.id !== seat.id);
      // Tek sipariş grubu yerine tüm salon görünüyor: en fazla 50 koltuk.
      if (prev.length >= 50) return prev;
      return [
        ...prev,
        {
          id: seat.id,
          seat_label: seat.seat_label,
          row_label: row.row_label,
          section_name: sectionName,
          ticket_id: String(row.ticket_id),
          ticket_name: row.ticket_name || "Bilet",
          price: Number(row.price) || 0,
        },
      ];
    });
  };

  const loadSales = useCallback(async () => {
    const stamp = ++cancelRef.current;
    setListLoading(true);
    const { from, to } = localDayRange(day);
    // Admin için boş eventId = tüm etkinliklerin gün kaydı.
    const params = new URLSearchParams({ from, to });
    if (eventId) params.set("event_id", eventId);
    const res = await withAuth(`/api/door-sales?${params.toString()}`).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | {
          success?: boolean;
          sales?: SaleRow[];
          bySeller?: SellerTotal[];
          totals?: typeof totals;
          message?: string;
        }
      | null;
    if (stamp !== cancelRef.current) return;
    setListLoading(false);
    if (!res?.ok || data?.success === false) {
      setSales([]);
      setBySeller([]);
      setTotals(null);
      setError(data?.message || "Gişe listesi alınamadı.");
      return;
    }
    setError(null);
    setSales(Array.isArray(data?.sales) ? data.sales : []);
    setBySeller(Array.isArray(data?.bySeller) ? data.bySeller : []);
    setTotals(data?.totals ?? null);
  }, [eventId, day]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  const loadCash = useCallback(async () => {
    const params = canSell ? "" : `?${new URLSearchParams(localDayRange(day)).toString()}`;
    const res = await withAuth(`/api/door-cash${params}`).catch(() => null);
    const data = (await res?.json().catch(() => null)) as
      | { success?: boolean; message?: string; openSession?: CashSessionRow | null; sessions?: CashSessionRow[] }
      | null;
    if (!res?.ok || data?.success === false) {
      if (!canSell) setCashSessions([]);
      setCash(null);
      return;
    }
    setCash(data as CashState);
    setCashSessions(Array.isArray(data?.sessions) ? data.sessions : []);
  }, [canSell, day]);

  useEffect(() => {
    void loadCash();
  }, [loadCash]);

  const openCash = async () => {
    setCashBusy(true);
    setError(null);
    try {
      const res = await withAuth("/api/door-cash", {
        method: "POST",
        body: JSON.stringify({ action: "open", opening_amount: Number(openingAmount) || 0, event_id: eventId }),
      });
      const data = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || data?.success !== true) setError(data?.message || "Kasa açılamadı.");
      else await loadCash();
    } finally {
      setCashBusy(false);
    }
  };

  const closeCash = async () => {
    setCashBusy(true);
    setError(null);
    try {
      const res = await withAuth("/api/door-cash", {
        method: "POST",
        body: JSON.stringify({ action: "close", counted_cash: Number(countedCash) }),
      });
      const data = (await res.json().catch(() => null)) as
        { success?: boolean; message?: string; expectedCash?: number; difference?: number } | null;
      if (!res.ok || data?.success !== true) {
        setError(data?.message || "Kasa kapatılamadı.");
        return;
      }
      setClosing(false);
      setCountedCash("");
      setError(null);
      setShiftResult({ expectedCash: Number(data.expectedCash) || 0, difference: Number(data.difference) || 0 });
      await Promise.all([loadCash(), loadSales()]);
    } finally {
      setCashBusy(false);
    }
  };

  const selectedEvent = useMemo(
    () => events.find((e) => String(e.id) === eventId) || null,
    [events, eventId]
  );
  const hasSeatPlan = Boolean(selectedEvent?.seating_plan_id);

  const selectedTicket = useMemo(
    () => tickets.find((t) => String(t.id) === ticketId) || null,
    [tickets, ticketId]
  );
  const unitPrice = Number(selectedTicket?.price ?? 0) || 0;
  const available = Number(selectedTicket?.available ?? 0) || 0;
  const lineTotal = payment === "free" ? 0 : Math.round(unitPrice * quantity * 100) / 100;
  const tillOpen = Boolean(cash?.openSession);
  // Kasa API'si hiç cevap vermezse (migration 149 yok) satış kapanmasın.
  const cashBlocksSale = cash !== null && !tillOpen;

  // Koltuklar tüm salondan seçiliyor: bilet türü sıranın çözümlendiği türden gelir.
  const seatGroups = useMemo(() => {
    const map = new Map<
      string,
      { ticket_id: string; ticket_name: string; price: number; seats: SelectedSeat[] }
    >();
    for (const seat of selectedSeats) {
      const group =
        map.get(seat.ticket_id) ||
        { ticket_id: seat.ticket_id, ticket_name: seat.ticket_name, price: seat.price, seats: [] };
      group.seats.push(seat);
      map.set(seat.ticket_id, group);
    }
    return [...map.values()];
  }, [selectedSeats]);

  const selectedSeatIds = useMemo(
    () => new Set(selectedSeats.map((s) => s.id)),
    [selectedSeats]
  );

  const pickerGroups = useMemo<HallSeatGroup[]>(
    () =>
      seatGroups.map((group) => ({
        ticket_id: group.ticket_id,
        ticket_name: group.ticket_name,
        price: group.price,
        seats: group.seats.map((s) => ({
          id: s.id,
          label: `${s.section_name ? `${s.section_name} ` : ""}${s.row_label}-${s.seat_label}`,
        })),
      })),
    [seatGroups]
  );

  const freeSeatCount = useMemo(
    () =>
      seatSections.reduce(
        (sum, section) =>
          sum +
          section.rows.reduce(
            (rowSum, row) => rowSum + row.seats.filter((s) => s.status === "free").length,
            0
          ),
        0
      ),
    [seatSections]
  );

  const seatTotal =
    payment === "free"
      ? 0
      : Math.round(seatGroups.reduce((sum, g) => sum + g.price * g.seats.length, 0) * 100) / 100;

  const seatStockOver = useMemo(() => {
    for (const group of seatGroups) {
      const row = tickets.find((t) => String(t.id) === group.ticket_id);
      const stock = Number(row?.available ?? 0) || 0;
      if (stock > 0 && group.seats.length > stock) return group;
    }
    return null;
  }, [seatGroups, tickets]);

  const saleCount = seatMode ? selectedSeats.length : quantity;
  const saleTotal = seatMode ? seatTotal : lineTotal;
  const saleBlocked =
    busy ||
    cashBlocksSale ||
    (seatMode
      ? selectedSeats.length === 0 || Boolean(seatStockOver)
      : !ticketId || (available > 0 && quantity > available));

  const submit = async () => {
    if (busy) return;
    if (buyerName.trim().split(/\s+/).filter(Boolean).length < 2) {
      setError("Fatura kesilebilmesi için müşterinin ad ve soyadını yazın.");
      return;
    }
    if (seatMode) {
      if (selectedSeats.length === 0) {
        setError("Önce salondan koltuk seçin.");
        return;
      }
      if (seatStockOver) {
        setError(`${seatStockOver.ticket_name} türünde yalnız ${Number(
          tickets.find((t) => String(t.id) === seatStockOver.ticket_id)?.available ?? 0
        ) || 0} bilet kaldı.`);
        return;
      }
    } else if (!ticketId) {
      return;
    }

    const requests = seatMode
      ? seatGroups.map((group) => ({
          ticket_id: group.ticket_id,
          quantity: group.seats.length,
          seat_ids: group.seats.map((s) => s.id),
          groupLabel: `${group.ticket_name} × ${group.seats.length}`,
        }))
      : [
          {
            ticket_id: ticketId,
            quantity,
            seat_ids: [] as string[],
            groupLabel: `${selectedTicket?.name || selectedTicket?.ticket_type || "Bilet"} × ${quantity}`,
          },
        ];

    setBusy(true);
    setError(null);
    setResults([]);
    try {
      const cards: SaleResultCard[] = [];
      let failure: string | null = null;
      for (const request of requests) {
        const res = await withAuth("/api/door-sales", {
          method: "POST",
          body: JSON.stringify({
            ticket_id: request.ticket_id,
            quantity: request.quantity,
            seat_ids: request.seat_ids,
            payment,
            buyer_name: buyerName.trim(),
            buyer_email: buyerEmail.trim(),
            note: note.trim(),
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | (SaleResult & { success?: boolean; message?: string })
          | null;
        if (!res.ok || data?.success !== true) {
          failure = data?.message || `Gişe satışı yapılamadı (HTTP ${res.status}).`;
          break;
        }
        cards.push({ ...(data as SaleResult), groupLabel: request.groupLabel });
      }
      if (cards.length === 0) {
        setError(failure || "Gişe satışı tamamlanamadı.");
        return;
      }
      if (failure) {
        setError(`${cards.length}/${requests.length} bilet grubu kesildi. Kalanı: ${failure}`);
      }
      setResults(cards);
      setBuyerName("");
      setBuyerEmail("");
      setNote("");
      setSelectedSeats([]);
      if (seatMode) void loadSeatGrid();
      const ticketsRes = await fetch(`/api/event-tickets?event_id=${encodeURIComponent(eventId)}`, {
        cache: "no-store",
      });
      const ticketsData = (await ticketsRes.json().catch(() => null)) as { tickets?: TicketRow[] } | null;
      if (Array.isArray(ticketsData?.tickets)) setTickets(ticketsData.tickets);
      await Promise.all([loadSales(), loadCash()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gişe satışı tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  const cancelSale = async (row: SaleRow) => {
    const ok = window.confirm(
      `${row.ticket_name || "Bilet"} × ${row.quantity ?? 1} — ${money(
        Number(row.total_price) || 0
      )} iptal edilsin mi? Stok ve koltuk geri döner.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const res = await withAuth(`/api/door-sales/${row.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Gişe iptali" }),
      });
      const data = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!res.ok || data?.success !== true) {
        setError(data?.message || "İptal edilemedi.");
      } else {
        setError(null);
        await Promise.all([loadSales(), loadCash()]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">
            {canSell ? "Gişe satışı" : "Gişe kayıtları"}
          </h1>
          <p className="text-sm text-ink-600">
            {canSell
              ? "Kapıda yüz yüze tahsil edilen biletler burada kesilir; stok ve bilet kodu çevrimiçi satışla aynı şekilde işler."
              : "Kapıda kesilen biletlerin günü, kimin kestiği ve etkinlik kırılımı burada izlenir."}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-lg border border-ink-200 bg-white px-3 py-1.5">
            Nakit: <b>{money(totals?.cash ?? 0)}</b>
          </span>
          <span className="rounded-lg border border-ink-200 bg-white px-3 py-1.5">
            Kart: <b>{money(totals?.card ?? 0)}</b>
          </span>
          <span className="rounded-lg border border-ink-200 bg-white px-3 py-1.5">
            Bilet: <b>{totals?.tickets ?? 0}</b>
          </span>
          {totals && totals.free > 0 ? (
            <span className="rounded-lg border border-ink-200 bg-white px-3 py-1.5">
              Davetiye: <b>{totals.free}</b>
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          {canSell ? (
            <div className="mb-4 rounded-lg border border-ink-200 bg-ink-50 p-3">
              <h2 className="text-xs font-semibold text-ink-600">Kasa (vardiya)</h2>
              {cash?.openSession ? (
                <>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-ink-800">
                    <dt>Açılış</dt>
                    <dd className="text-right font-semibold">{money(Number(cash.openSession.opening_amount) || 0)}</dd>
                    <dt>Vardiyada nakit</dt>
                    <dd className="text-right font-semibold">
                      {money(Number(cash.openSession.summary?.cash_total ?? 0))}
                    </dd>
                    <dt>Beklenen</dt>
                    <dd className="text-right font-semibold">
                      {money(
                        (Number(cash.openSession.opening_amount) || 0) +
                          Number(cash.openSession.summary?.cash_total ?? 0)
                      )}
                    </dd>
                    <dt>Kesilen bilet</dt>
                    <dd className="text-right font-semibold">{cash.openSession.summary?.tickets ?? 0}</dd>
                  </dl>
                  {closing ? (
                    <div className="mt-3">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={countedCash}
                        onChange={(e) => setCountedCash(e.target.value)}
                        placeholder="Kasada saydığın para"
                        className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void closeCash()}
                          disabled={cashBusy || countedCash === ""}
                          className="min-h-[40px] flex-1 rounded-lg bg-gold-500 px-3 text-sm font-bold text-white hover:bg-gold-600 disabled:opacity-50"
                        >
                          Kasayı kapat
                        </button>
                        <button
                          type="button"
                          onClick={() => setClosing(false)}
                          className="min-h-[40px] rounded-lg border border-ink-300 px-3 text-sm hover:bg-ink-100"
                        >
                          Vazgeç
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClosing(true)}
                      className="mt-3 min-h-[40px] w-full rounded-lg border border-ink-300 bg-white px-3 text-sm font-semibold text-ink-800 hover:bg-ink-100"
                    >
                      Kasa kapat / sayım yap
                    </button>
                  )}
                </>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                    placeholder="Başlangıç parası"
                    className="w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void openCash()}
                    disabled={cashBusy || openingAmount === ""}
                    className="min-h-[40px] shrink-0 rounded-lg bg-gold-500 px-4 text-sm font-bold text-white hover:bg-gold-600 disabled:opacity-50"
                  >
                    Kasa aç
                  </button>
                </div>
              )}
              {shiftResult ? (
                <p className="mt-2 text-sm text-ink-700">
                  Vardiya kapandı — beklenen {money(shiftResult.expectedCash)}, fark{" "}
                  <b>{signedMoney(shiftResult.difference)}</b>.
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="block text-xs font-semibold text-ink-600">Etkinlik</label>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">{canSell ? "Seçin…" : "Tüm etkinlikler"}</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.date ? String(ev.date).slice(0, 10) : ""} — {ev.title || "Etkinlik"}
              </option>
            ))}
          </select>

          {canSell ? (
            <>
              {hasSeatPlan ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSeatMode(true);
                      setHallKey((k) => k + 1);
                      setHallOpen(true);
                    }}
                    className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold ${
                      seatMode
                        ? "border-gold-500 bg-gold-500 text-white"
                        : "border-ink-300 bg-white text-ink-800 hover:bg-ink-50"
                    }`}
                  >
                    <Armchair className="h-4 w-4" />
                    {seatMode ? "Koltukları salondan seçiyorum" : "Koltukları salondan ben seçeyim"}
                  </button>
                  {seatMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSeatMode(false);
                        setHallOpen(false);
                        setSelectedSeats([]);
                      }}
                      className="min-h-[44px] rounded-lg border border-ink-300 px-3 text-sm hover:bg-ink-50"
                    >
                      Sistem seçsin
                    </button>
                  ) : null}
                </div>
              ) : null}

              {seatMode ? null : (
                <>
                  <label className="mt-4 block text-xs font-semibold text-ink-600">Bilet türü</label>
                  <select
                    value={ticketId}
                    onChange={(e) => setTicketId(e.target.value)}
                    disabled={!eventId || tickets.length === 0}
                    className="mt-1 w-full rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {tickets.length === 0 ? <option value="">Önce etkinlik seçin</option> : null}
                    {tickets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || t.ticket_type || "Bilet"} — {money(Number(t.price) || 0)} (kalan{" "}
                        {Number(t.available) || 0})
                      </option>
                    ))}
                  </select>

                  <div className="mt-4 flex items-center gap-3">
                    <label className="text-xs font-semibold text-ink-600">Adet</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                      className="w-20 rounded-lg border border-ink-300 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      {[1, 2, 5, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setQuantity(n)}
                          className="min-h-[36px] rounded-lg border border-ink-300 px-3 text-sm hover:bg-ink-50"
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-ink-500">Koltukları sistem seçer.</p>
                  </div>
                </>
              )}

              {seatMode ? (
                <div className="mt-3 rounded-lg border border-ink-200 bg-white p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setHallKey((k) => k + 1);
                      setHallOpen(true);
                    }}
                    className="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-ink-300 bg-white px-3 text-sm font-medium hover:bg-ink-50"
                  >
                    <Armchair className="h-4 w-4" /> Salonu aç ({freeSeatCount} boş koltuk)
                  </button>
                  {selectedSeats.length === 0 ? (
                    <p className="mt-2 text-xs text-ink-500">
                      Henüz koltuk seçilmedi. Seçtiğin sıra hangi bilet türüne bağlıysa satış o türden kesilir.
                    </p>
                  ) : (
                    <>
                      <ul className="mt-2 space-y-1 text-xs text-ink-700">
                        {seatGroups.map((group) => (
                          <li key={group.ticket_id} className="flex items-center justify-between gap-2">
                            <span className="font-semibold">
                              {group.ticket_name} × {group.seats.length}
                            </span>
                            <span>{money(group.price * group.seats.length)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 text-xs text-ink-500">
                        {selectedSeats.map((s) => `${s.row_label}-${s.seat_label}`).join(", ")}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-sm font-semibold text-ink-900">
                        <span>Toplam</span>
                        <span>{money(seatTotal)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedSeats([])}
                        className="mt-1 text-xs underline"
                      >
                        Seçimi temizle
                      </button>
                    </>
                  )}
                </div>
              ) : null}

              {hallOpen ? (
                <DoorHallPicker
                  key={hallKey}
                  sections={seatSections}
                  loading={seatLoading}
                  error={seatError}
                  freeSeatCount={freeSeatCount}
                  selectedIds={selectedSeatIds}
                  groups={pickerGroups}
                  total={seatTotal}
                  onToggleSeat={toggleSeat}
                  onClear={() => setSelectedSeats([])}
                  onClose={() => setHallOpen(false)}
                />
              ) : null}

              <div className="mt-4 grid grid-cols-3 gap-2">
                {(["cash", "card", "free"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setPayment(kind)}
                    className={`min-h-[44px] rounded-lg border px-2 text-sm font-semibold ${
                      payment === kind
                        ? "border-gold-500 bg-gold-500 text-white"
                        : "border-ink-300 bg-white text-ink-800 hover:bg-ink-50"
                    }`}
                  >
                    {PAYMENT_LABEL[kind]}
                  </button>
                ))}
              </div>

              <input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Müşteri adı soyadı (zorunlu)"
                className="mt-3 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
              />
              <input
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="E-posta (bilet maili gönderilirse zorunlu)"
                className="mt-2 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Not (ör. grup, refakatçi)"
                className="mt-2 w-full rounded-lg border border-ink-300 px-3 py-2 text-sm"
              />

              <button
                type="button"
                onClick={submit}
                disabled={saleBlocked}
                className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-gold-500 px-4 text-base font-bold text-white hover:bg-gold-600 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                {saleCount} bilet kes — {money(saleTotal)}
              </button>

              {seatMode && seatStockOver ? (
                <p className="mt-2 text-sm text-gold-600">
                  {seatStockOver.ticket_name} türünde {seatStockOver.seats.length} koltuk seçtiniz, stok
                  yetersiz.
                </p>
              ) : null}

              {!seatMode && selectedTicket && available > 0 && quantity > available ? (
                <p className="mt-2 text-sm text-gold-600">
                  Bu bilet türünde yalnız {available} adet kaldı.
                </p>
              ) : null}

              {cashBlocksSale ? (
                <p className="mt-2 text-sm text-gold-600">
                  Sayım takibi için önce yukarıdaki kasayı aç.
                </p>
              ) : null}

              {results.map((card) => (
                <div key={card.orderId} className="mt-4 rounded-lg border border-ink-200 bg-ink-50 p-3">
                  <div className="flex items-center gap-2 font-semibold text-ink-900">
                    <BadgePercent className="h-4 w-4" /> {card.groupLabel} —{" "}
                    {money(Number(card.totalPrice), card.currency)}
                  </div>
                  {card.orderNumber ? (
                    <p className="mt-1 font-mono text-xs text-ink-600">Satış No: {card.orderNumber}</p>
                  ) : null}
                  <ul className="mt-2 space-y-1 font-mono text-sm text-ink-800">
                    {(card.seatDetails?.length
                      ? card.seatDetails.map((seat) => ({
                          code: seat.ticket_code,
                          label: `${seat.row_label}-${seat.seat_label}`,
                        }))
                      : card.ticketCodes.map((code) => ({ code, label: "" }))
                    ).map((item) => (
                      <li key={item.code}>
                        {item.label ? (
                          <span className="font-sans text-ink-600">{item.label}</span>
                        ) : null}{" "}
                        {item.code}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/api/orders/${card.orderId}/ticket-pdf`}
                      target="_blank"
                      rel="noopener"
                      className="flex min-h-[40px] items-center gap-2 rounded-lg border border-ink-300 bg-white px-3 text-sm font-medium hover:bg-ink-100"
                    >
                      <FileDown className="h-4 w-4" /> PDF / yazdır
                    </Link>
                    {card.emailSent ? (
                      <span className="text-sm text-ink-600">Bilet maili gönderildi.</span>
                    ) : (
                      <span className="text-sm text-ink-600">
                        {card.emailReason || "E-posta girilmedi; müşteri kodu elden verin."}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <p className="mt-4 text-sm text-ink-600">
              Kapıda bileti gişe görevlisi ve organizatör keser; yönetici yalnız kayıtları görür.
            </p>
          )}

          {error ? (
            <p className="mt-2 flex items-start gap-2 text-sm text-gold-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-ink-900">Günün gişe kayıtları</h2>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="rounded-lg border border-ink-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => void loadSales()}
                className="min-h-[36px] rounded-lg border border-ink-300 px-3 text-sm hover:bg-ink-50"
              >
                Yenile
              </button>
            </div>
          </div>

          {!eventId && bySeller.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-ink-200 bg-ink-50 p-3">
              <h3 className="text-xs font-semibold text-ink-600">Kesen kişiye göre</h3>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-500">
                    <th className="py-1 pr-2 font-semibold">Görevli</th>
                    <th className="py-1 pr-2 font-semibold">Sipariş</th>
                    <th className="py-1 pr-2 font-semibold">Bilet</th>
                    <th className="py-1 font-semibold">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {bySeller.map((row) => (
                    <tr key={row.name} className="border-t border-ink-200">
                      <td className="py-1 pr-2 text-ink-900">{row.name}</td>
                      <td className="py-1 pr-2">{row.orders}</td>
                      <td className="py-1 pr-2">{row.tickets}</td>
                      <td className="py-1">{money(row.gross)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!canSell && cashSessions.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-ink-200 bg-ink-50 p-3">
              <h3 className="text-xs font-semibold text-ink-600">Kasa vardiyaları</h3>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink-500">
                    <th className="py-1 pr-2 font-semibold">Görevli</th>
                    <th className="py-1 pr-2 font-semibold">Açılış</th>
                    <th className="py-1 pr-2 font-semibold">Beklenen</th>
                    <th className="py-1 pr-2 font-semibold">Sayılan</th>
                    <th className="py-1 font-semibold">Fark</th>
                  </tr>
                </thead>
                <tbody>
                  {cashSessions.map((session) => (
                    <tr key={session.id} className="border-t border-ink-200">
                      <td className="py-1 pr-2 text-ink-900">
                        {session.staff_name || "Görevli"}
                        <span className="ml-1 text-xs text-ink-500">
                          {session.status === "open" ? `(açık ${stamp(session.opened_at)})` : stamp(session.closed_at)}
                        </span>
                      </td>
                      <td className="py-1 pr-2">{money(Number(session.opening_amount) || 0)}</td>
                      <td className="py-1 pr-2">{money(Number(session.expected_cash) || 0)}</td>
                      <td className="py-1 pr-2">
                        {session.counted_cash === null || session.counted_cash === undefined
                          ? "—"
                          : money(Number(session.counted_cash))}
                      </td>
                      <td
                        className={`py-1 font-semibold ${
                          Number(session.difference) > 0
                            ? "text-emerald-700"
                            : Number(session.difference) < 0
                              ? "text-gold-700"
                              : "text-ink-700"
                        }`}
                      >
                        {session.difference === null || session.difference === undefined
                          ? "—"
                          : signedMoney(Number(session.difference))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {listLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-ink-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Getiriliyor…
            </div>
          ) : sales.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">Bu günde gişe satışı yok.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs text-ink-500">
                  <th className="py-2 pr-2 font-semibold">Saat</th>
                  {!eventId ? <th className="py-2 pr-2 font-semibold">Etkinlik</th> : null}
                  <th className="py-2 pr-2 font-semibold">Bilet</th>
                  <th className="py-2 pr-2 font-semibold">Adet</th>
                  <th className="py-2 pr-2 font-semibold">Tutar</th>
                  <th className="py-2 pr-2 font-semibold">Ödeme</th>
                  <th className="py-2 pr-2 font-semibold">Kesen</th>
                  <th className="py-2 pr-2 font-semibold">Durum</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {sales.map((row) => (
                  <tr key={row.id} className="border-b border-ink-100">
                    <td className="py-2 pr-2 whitespace-nowrap text-ink-600">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    {!eventId ? (
                      <td className="py-2 pr-2 text-ink-600">{row.event_title || "Etkinlik"}</td>
                    ) : null}
                    <td className="py-2 pr-2">
                      <div className="text-ink-900">{row.ticket_name || "Bilet"}</div>
                      <div className="font-mono text-xs text-ink-500">{row.ticket_code || ""}</div>
                    </td>
                    <td className="py-2 pr-2">{row.quantity ?? 1}</td>
                    <td className="py-2 pr-2">{money(Number(row.total_price) || 0)}</td>
                    <td className="py-2 pr-2">
                      {DOOR_PAYMENT_TEXT[String(row.door_payment || "cash")] || "Nakit"}
                    </td>
                    <td className="py-2 pr-2 text-ink-600">{row.seller_name || "—"}</td>
                    <td className="py-2 pr-2">
                      {row.status === "completed" ? (
                        <span className="rounded bg-ink-100 px-2 py-0.5 text-xs">satıldı</span>
                      ) : (
                        <span className="rounded bg-gold-50 px-2 py-0.5 text-xs text-gold-700">
                          {row.status}
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {row.status === "completed" ? (
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/api/orders/${row.id}/ticket-pdf`}
                            target="_blank"
                            rel="noopener"
                            className="flex min-h-[32px] items-center gap-1 rounded-lg border border-ink-300 px-2 text-xs hover:bg-ink-50"
                          >
                            <FileDown className="h-3.5 w-3.5" /> Yazdır
                          </Link>
                          <button
                            type="button"
                            onClick={() => void cancelSale(row)}
                            disabled={busy}
                            className="flex min-h-[32px] items-center gap-1 rounded-lg border border-ink-300 px-2 text-xs hover:bg-ink-50 disabled:opacity-50"
                          >
                            <Undo2 className="h-3.5 w-3.5" /> İptal
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totals ? (
            <p className="mt-3 text-sm text-ink-600">
              Gün toplamı: <b>{money(totals.gross)}</b> ({totals.orders} sipariş, {totals.tickets} bilet)
              {totals.cancelled > 0 ? ` · ${totals.cancelled} iptal` : ""}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
