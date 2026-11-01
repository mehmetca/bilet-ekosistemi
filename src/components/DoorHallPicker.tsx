"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize, X, ZoomIn, ZoomOut } from "lucide-react";

export type SeatStatus = "free" | "sold" | "held" | "blocked";

export type HallSeat = { id: string; seat_label: string; status: SeatStatus };

export type HallRow = {
  id: string;
  row_label: string;
  ticket_id: string | null;
  ticket_name: string | null;
  price: number | null;
  seats: HallSeat[];
};

export type HallSection = {
  id: string;
  name: string;
  section_align?: string | null;
  rows: HallRow[];
};

export type HallSeatGroup = {
  ticket_id: string;
  ticket_name: string;
  price: number;
  seats: { id: string; label: string }[];
};

const CATEGORY_COLORS = [
  "#F59E0B",
  "#DC0B2C",
  "#2563EB",
  "#059669",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#65A30D",
];

const money = (value: number, currency = "EUR") =>
  `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const BASE_SEAT_PX = 24;
const MIN_SEAT_PX = 9;
const MAX_SEAT_PX = 40;
const ZOOM_STEP = 2;

/** Salonın yatay sütunu: önce section_align (oturum planı editörü), yoksa bölüm adındaki sol/sağ. */
function sectionColumn(section: HallSection): 0 | 1 | 2 {
  if (section.section_align === "left") return 0;
  if (section.section_align === "right") return 2;
  if (section.section_align === "center") return 1;
  const name = String(section.name || "").toLowerCase();
  if (name.includes("sol") || name.includes("left") || name.includes("links")) return 0;
  if (name.includes("sağ") || name.includes("sag") || name.includes("right") || name.includes("rechts"))
    return 2;
  return 1;
}

function SectionBlock({
  section,
  colorByTicketId,
  selectedIds,
  seatPx,
  onToggleSeat,
}: {
  section: HallSection;
  colorByTicketId: Map<string, string>;
  selectedIds: Set<string>;
  seatPx: number;
  onToggleSeat: (seat: HallSeat, row: HallRow, sectionName: string) => void;
}) {
  const gap = Math.max(1, Math.round(seatPx * 0.16));
  return (
    <div className="w-max rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 text-center text-sm font-semibold text-slate-800">
        {section.name || "Bölüm"}
      </div>
      <div className="flex flex-col gap-1">
        {section.rows.map((row) => {
          const color = row.ticket_id ? colorByTicketId.get(row.ticket_id) || "#94A3B8" : "#CBD5E1";
          return (
            <div key={row.id} className="flex items-center gap-2">
              <span
                className="shrink-0 text-right text-slate-500"
                style={{ width: seatPx + 8, fontSize: Math.max(9, Math.round(seatPx * 0.5)) }}
              >
                {row.row_label}
              </span>
              <div className="flex" style={{ gap }}>
                {row.seats.map((seat) => {
                  const on = selectedIds.has(seat.id);
                  const selectable = seat.status === "free" && Boolean(row.ticket_id);
                  const bg = on
                    ? "#16A34A"
                    : seat.status === "sold"
                      ? "#CBD5E1"
                      : seat.status === "held"
                        ? "#FBBF24"
                        : seat.status === "blocked"
                          ? "#94A3B8"
                          : selectable
                            ? color
                            : "#E2E8F0";
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      disabled={(seat.status !== "free" && !on) || !row.ticket_id}
                      onClick={() => onToggleSeat(seat, row, String(section.name || ""))}
                      title={
                        seat.status === "sold"
                          ? "Satılmış"
                          : seat.status === "held"
                            ? "Sepette ayrılmış"
                            : seat.status === "blocked"
                              ? "Satışa kapalı"
                              : row.ticket_id
                                ? `${section.name} ${row.row_label}-${seat.seat_label} · ${row.ticket_name} · ${money(Number(row.price) || 0)}`
                                : "Bu sıraya bir bilet türü bağlı değil"
                      }
                      style={{
                        backgroundColor: bg,
                        width: seatPx,
                        height: seatPx,
                        fontSize: Math.max(8, Math.round(seatPx * 0.42)),
                      }}
                      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
                        on ? "ring-2 ring-slate-900" : ""
                      } ${
                        seat.status === "free" && row.ticket_id
                          ? "cursor-pointer hover:opacity-80"
                          : "cursor-not-allowed"
                      }`}
                    >
                      {seat.seat_label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Gişede tam ekran salon seçici: sold + boş tüm koltuklar, kategori rengiyle.
 * Bölümler salonun gerçek yerleşimiyle (sol / orta / sağ sütun) yan yana durur.
 * Bilet türü seçilen sıradan türer; ayrı kategori seçimi yoktur.
 */
export default function DoorHallPicker({
  sections,
  loading,
  error,
  freeSeatCount,
  selectedIds,
  groups,
  total,
  onToggleSeat,
  onClear,
  onClose,
}: {
  sections: HallSection[];
  loading: boolean;
  error: string | null;
  freeSeatCount: number;
  selectedIds: Set<string>;
  groups: HallSeatGroup[];
  total: number;
  onToggleSeat: (seat: HallSeat, row: HallRow, sectionName: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [seatPx, setSeatPx] = useState(BASE_SEAT_PX);

  /** Koltukları küçülterek salonu görünen alana sığdırır (kırpılma olmasın diye). */
  const fitToArea = useCallback(() => {
    const area = scrollRef.current;
    if (!area) return;
    const ratio = Math.min(
      area.clientWidth / Math.max(1, area.scrollWidth),
      area.clientHeight / Math.max(1, area.scrollHeight)
    );
    setSeatPx(Math.max(MIN_SEAT_PX, Math.min(BASE_SEAT_PX, Math.floor(BASE_SEAT_PX * ratio))));
  }, []);

  useEffect(() => {
    if (!sections.length) return;
    const raf = requestAnimationFrame(fitToArea);
    return () => cancelAnimationFrame(raf);
  }, [sections, fitToArea]);

  const colorByTicketId = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of sections) {
      for (const row of section.rows) {
        if (!row.ticket_id || map.has(row.ticket_id)) continue;
        map.set(row.ticket_id, CATEGORY_COLORS[map.size % CATEGORY_COLORS.length] as string);
      }
    }
    return map;
  }, [sections]);

  // Aynı sütundaki bölümler alt alta, sütunlar yan yana: salon nasıl kurulduysa öyle.
  const columns = useMemo(() => {
    const cols: HallSection[][] = [[], [], []];
    sections.forEach((s) => cols[sectionColumn(s)]?.push(s));
    return cols.filter((column) => column.length > 0);
  }, [sections]);

  const legend = useMemo(
    () =>
      [...colorByTicketId.entries()].map(([ticketId, color]) => {
        const row = sections.flatMap((s) => s.rows).find((r) => r.ticket_id === ticketId);
        return { ticketId, color, name: row?.ticket_name || "Tür", price: Number(row?.price) || 0 };
      }),
    [colorByTicketId, sections]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Salondan koltuk seçimi"
    >
      <div className="flex h-full max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="font-semibold text-slate-900">Salondan koltuk seç</h2>
            <p className="text-xs text-slate-500">
              {loading
                ? "Plan yükleniyor…"
                : `${freeSeatCount} boş koltuk · bilet türü seçtiğin sıradan gelir`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-300 p-1">
              <button
                type="button"
                aria-label="Küçült"
                onClick={() => setSeatPx((v) => Math.max(MIN_SEAT_PX, v - ZOOM_STEP))}
                className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="w-11 text-center text-xs text-slate-600">
                {Math.round((seatPx / BASE_SEAT_PX) * 100)}%
              </span>
              <button
                type="button"
                aria-label="Büyüt"
                onClick={() => setSeatPx((v) => Math.min(MAX_SEAT_PX, v + ZOOM_STEP))}
                className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Ekrana sığdır"
                onClick={fitToArea}
                className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-100"
              >
                <Maximize className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50"
            >
              <X className="h-4 w-4" /> Kapat
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-slate-50 p-4">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : sections.length === 0 ? (
              <p className="text-sm text-slate-500">
                {loading ? "Salon planı yükleniyor…" : "Salon planında sıra/koltuk bulunamadı."}
              </p>
            ) : (
              <div className="mx-auto flex w-max flex-col gap-4">
                <div className="mx-auto w-full max-w-3xl rounded-md bg-slate-800 py-2 text-center text-xs font-semibold uppercase tracking-widest text-white">
                  Sahne
                </div>
                <div className="flex items-start justify-center gap-4">
                  {columns.map((column, index) => (
                    <div key={index} className="flex shrink-0 flex-col gap-3">
                      {column.map((section) => (
                        <SectionBlock
                          key={section.id}
                          section={section}
                          colorByTicketId={colorByTicketId}
                          selectedIds={selectedIds}
                          seatPx={seatPx}
                          onToggleSeat={onToggleSeat}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="flex max-h-56 w-full shrink-0 flex-col border-t border-slate-200 bg-white p-4 lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
              {legend.map((item) => (
                <span key={item.ticketId} className="flex items-center gap-1">
                  <i className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name} · {money(item.price)}
                </span>
              ))}
              <span className="flex items-center gap-1">
                <i className="h-3 w-3 rounded-full bg-[#16A34A]" /> seçili
              </span>
              <span className="flex items-center gap-1">
                <i className="h-3 w-3 rounded-full bg-[#FBBF24]" /> sepette
              </span>
              <span className="flex items-center gap-1">
                <i className="h-3 w-3 rounded-full bg-[#CBD5E1]" /> satılmış / kapalı
              </span>
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-auto">
              {groups.length === 0 ? (
                <p className="text-sm text-slate-500">Plandan koltuk seçin.</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-800">
                  {groups.map((group) => (
                    <li key={group.ticket_id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {group.ticket_name} × {group.seats.length}
                        </span>
                        <span>{money(group.price * group.seats.length)}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {group.seats.map((s) => s.label).join(", ")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                <span>Toplam</span>
                <span>{money(total)}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onClear}
                  disabled={groups.length === 0}
                  className="min-h-[40px] flex-1 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Seçimi temizle
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] flex-1 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Gişeye dön
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
