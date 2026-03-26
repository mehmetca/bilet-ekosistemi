"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Calendar, MapPin, Clock, Ticket, Share2, Heart, ChevronRight, Star, Users, Car, DoorOpen, HelpCircle, ChevronDown, ChevronUp, Bell, Building2, Armchair, LayoutGrid } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Header from "@/components/Header";
import type { Event, Ticket as EventTicket, Venue } from "@/types/database";
import { parseEventDescription } from "@/lib/eventMeta";
import { formatPrice } from "@/lib/formatPrice";
import { getLocalizedEvent } from "@/lib/i18n-content";
import { extractMapEmbedUrl } from "@/lib/mapEmbed";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase-client";
import { getPlan } from "@/lib/seating-plans";
import { musensaal } from "@/lib/seating-plans/musensaal";
import SalonPlanViewer from "@/components/SalonPlanViewer";
import ImageSeatPlanViewer from "@/components/ImageSeatPlanViewer";
import {
  theaterduisburgImagePlan,
  getTheaterDuisburgCoord,
  THEATER_DUISBURG_IMAGE_ASPECT,
  THEATER_DUISBURG_VIEWBOX_W,
  isTheaterDuisburgVisualPlanName,
  seatingPlanSectionsMatchTheaterDuisburgTemplate,
  seatingPlanLooksLikeGermanTheaterButNotImage,
  buildTheaterDuisburgSeatItemsWithCoords,
} from "@/lib/seating-plans/theaterduisburg";
import { planSectionsMatchMusensaalTemplate } from "@/lib/seating-plans/musensaal-structure-match";
import { formatEventDateDMY } from "@/lib/date-utils";

const SEAT_HOLD_LS_KEY = "seatHoldSessionId";

/** localStorage kapalı / hata: yine de koltuk seçimi çalışsın (oturum boyunca bellekte). */
function ensureSeatHoldSessionId(existing: string | null): string {
  if (existing) return existing;
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(SEAT_HOLD_LS_KEY);
    if (!id) {
      id = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      window.localStorage.setItem(SEAT_HOLD_LS_KEY, id);
    }
    return id;
  } catch {
    return window.crypto?.randomUUID?.() ?? `t_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

interface EventDetailClientProps {
  event: Event;
  tickets: EventTicket[];
  venue?: Venue | null;
  organizerDisplayName?: string | null;
  locale?: "tr" | "de" | "en";
  /** Etkinlik henüz onaylanmadı (organizatör önizlemesi); bilet satışı kapalı */
  isUnapproved?: boolean;
}

/** Oturum planı: bölüm > sıra > koltuk (koltuk seçimi UI için); bölümde ticket_type_label etkinlikteki bilet adıyla eşlenir */
type SeatPlanSeat = { id: string; seat_label: string };
type SeatPlanRow = { id: string; row_label: string; ticket_type_label?: string | null; seats: SeatPlanSeat[] };
type SeatPlanSection = { id: string; name: string; ticket_type_label?: string | null; rows: SeatPlanRow[] };

type TicketLike = { id: string; name?: string | null; price?: number | null; available?: number | null };
const MUSENSAAL_PREFIXES = ["P", "EML", "EMR", "SEL", "SER", "EH"] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Musensaal önizleme planı ile DB koltuk id'leri arasında eşleme (SalonPlanViewer P-01-01 ↔ DB seat id). */
function buildMusensaalIdMaps(
  sections: SeatPlanSection[]
): { logicalToDbId: Map<string, string>; dbIdToLogical: Map<string, string> } {
  const logicalToDbId = new Map<string, string>();
  const dbIdToLogical = new Map<string, string>();
  if (!sections.length) return { logicalToDbId, dbIdToLogical };
  for (let i = 0; i < sections.length && i < MUSENSAAL_PREFIXES.length; i++) {
    const section = sections[i];
    const prefix = MUSENSAAL_PREFIXES[i];
    if (i < 5) {
      for (const row of section.rows) {
        const r = pad2(Number(row.row_label) || 0);
        for (const seat of row.seats) {
          const s = pad2(Number(seat.seat_label) || 0);
          const logicalId = `${prefix}-${r}-${s}`;
          logicalToDbId.set(logicalId, seat.id);
          dbIdToLogical.set(seat.id, logicalId);
        }
      }
    } else {
      const ehRows = musensaal.emporeHinten.rows;
      for (const dbRow of section.rows) {
        const rowNum = Number(dbRow.row_label) || 0;
        const staticRow = ehRows.find((r) => r.row === rowNum);
        if (!staticRow) continue;
        let idx = 0;
        for (const seat of dbRow.seats) {
          let logicalId: string;
          if (idx < staticRow.left) {
            logicalId = `EH-R${pad2(staticRow.row)}-L${pad2(idx + 1)}`;
          } else if (idx < staticRow.left + staticRow.middle) {
            logicalId = `EH-R${pad2(staticRow.row)}-M${pad2(idx - staticRow.left + 1)}`;
          } else {
            logicalId = `EH-R${pad2(staticRow.row)}-Rt${pad2(idx - staticRow.left - staticRow.middle + 1)}`;
          }
          logicalToDbId.set(logicalId, seat.id);
          dbIdToLogical.set(seat.id, logicalId);
          idx++;
        }
      }
    }
  }
  return { logicalToDbId, dbIdToLogical };
}

/** Bölüm için kullanılacak bilet: ticket_type_label, yoksa bölüm adı, yoksa sıra ile eşleştirir. */
function getTicketForSection(
  section: SeatPlanSection,
  sectionIndex: number,
  availableTickets: TicketLike[]
): { ticket: TicketLike; matchedBy: "name" | "index" } {
  if (!availableTickets.length) return { ticket: { id: "", name: "", price: 0, available: 0 }, matchedBy: "index" };
  const label = (section.ticket_type_label ?? "").trim();
  const sectionName = (section.name ?? "").trim();
  const byLabel = label
    ? availableTickets.find((t) => (t.name || "").trim().toLowerCase() === label.toLowerCase())
    : null;
  if (byLabel) return { ticket: byLabel, matchedBy: "name" };
  const bySectionName =
    !label && sectionName
      ? availableTickets.find((t) => (t.name || "").trim().toLowerCase() === sectionName.toLowerCase())
      : null;
  if (bySectionName) return { ticket: bySectionName, matchedBy: "name" };
  const byIndex = availableTickets[sectionIndex];
  return { ticket: byIndex ?? availableTickets[0], matchedBy: "index" };
}

function getTicketForRow(
  section: SeatPlanSection,
  row: SeatPlanRow | undefined,
  sectionIndex: number,
  availableTickets: TicketLike[]
): { ticket: TicketLike; matchedBy: "name" | "index" } {
  const rowLabel = (row?.ticket_type_label || "").trim();
  if (rowLabel) {
    const byRowLabel = availableTickets.find(
      (t) => (t.name || "").trim().toLowerCase() === rowLabel.toLowerCase()
    );
    if (byRowLabel) return { ticket: byRowLabel, matchedBy: "name" };
  }
  return getTicketForSection(section, sectionIndex, availableTickets);
}

function getCategoryColorHex(rawCategory: string): string {
  const category = (rawCategory || "").trim().toLowerCase();
  const palette: Record<string, string> = {
    vip: "#f59e0b",
    "vip bilet": "#f59e0b",
    "kategori 1": "#f43f5e",
    "kategori 2": "#3b82f6",
    "kategori 3": "#10b981",
    "kategori 4": "#06b6d4",
    "kategori 5": "#d946ef",
    "kategori 6": "#84cc16",
    "kategori 7": "#f97316",
    "kategori 8": "#8b5cf6",
    "kategori 9": "#14b8a6",
    "kategori 10": "#ef4444",
  };
  return palette[category] ?? "#64748b";
}

/** Eventim tarzı şematik salon planı: bölümleri yan yana, sahne altta, koltuklar tıklanabilir. Satılmış koltuklar dolu gösterilir, tıklanamaz. */
function SeatMapSvg({
  sections,
  selectedSeatIds,
  soldSeatIds,
  onSeatToggle,
  sectionColors,
  selectableSeatIds,
  seatTitleById,
  stageLabel,
  seatLabelWord,
}: {
  sections: SeatPlanSection[];
  selectedSeatIds: Set<string>;
  soldSeatIds: Set<string>;
  onSeatToggle: (seatId: string) => void;
  sectionColors: Map<string, string>;
  selectableSeatIds?: Set<string>;
  seatTitleById?: Map<string, string>;
  stageLabel: string;
  seatLabelWord: string;
}) {
  const [hoveredSeatId, setHoveredSeatId] = useState<string | null>(null);
  const pad = 12;
  const stageH = 34;
  const mapH = 560;
  const mapW = 1040;
  const stageGap = 8;
  const sectionGap = 10;
  const nSections = sections.length;
  if (nSections === 0) return null;
  const sectionMaxRows = Math.max(...sections.map((s) => s.rows.length), 1);
  const sectionMaxSeats = Math.max(
    ...sections.flatMap((s) => s.rows.map((r) => r.seats.length)),
    1
  );
  const seatingAreaW = mapW * 0.9;
  const sectionW = Math.max(150, Math.min(260, (seatingAreaW - (nSections - 1) * sectionGap) / nSections));
  const seatingTotalW = sectionW * nSections + sectionGap * (nSections - 1);
  const seatingStartX = pad + (mapW - seatingTotalW) / 2;
  const seatSize = Math.min(
    (sectionW - 26) / sectionMaxSeats,
    (mapH - 28) / sectionMaxRows,
    24
  );
  const rowH = (mapH - 28) / sectionMaxRows;
  const seatW = Math.min((sectionW - 26) / sectionMaxSeats, seatSize * 2.4);
  const stageTarget = sectionMaxSeats * seatW * 1.05;
  const stageWRaw = Math.max(mapW * 0.24, Math.min(mapW * 0.38, stageTarget));
  const stageW = Math.min(stageWRaw, seatingTotalW * 0.92);
  const stageX = pad + (mapW - stageW) / 2;

  return (
    <svg
      viewBox={`0 0 ${mapW + pad * 2} ${mapH + stageH + stageGap + pad * 2}`}
      className="w-full rounded-lg border border-slate-200 bg-white block"
      style={{ minWidth: 1040, minHeight: 690 }}
    >
      {/* Bölümler */}
      {sections.map((section, si) => {
        const sx = seatingStartX + si * (sectionW + sectionGap);
        return (
          <g key={section.id}>
            <rect
              x={sx}
              y={pad + stageH + stageGap}
              width={sectionW}
              height={mapH}
              rx={6}
              fill="#ffffff"
              stroke="#94a3b8"
              strokeWidth={1}
            />
            <text
              x={sx + sectionW / 2}
              y={pad + stageH + stageGap + 16}
              textAnchor="middle"
              fill="#334155"
              fontSize={11}
              fontWeight={600}
            >
              {section.name}
            </text>
            {section.rows.map((row, ri) => {
              const rowY = pad + stageH + stageGap + 24 + ri * rowH + rowH / 2;
              return (
                <g key={`row-${section.id}-${row.id}`}>
                  <text
                    x={sx + 3}
                    y={rowY + 3}
                    textAnchor="start"
                    fill="#64748b"
                    fontSize={9}
                    fontWeight={600}
                  >
                    {row.row_label}
                  </text>
                  <text
                    x={sx + sectionW - 3}
                    y={rowY + 3}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize={9}
                    fontWeight={600}
                  >
                    {row.row_label}
                  </text>
                  {row.seats.map((seat, ci) => {
                const cx = sx + 10 + ci * seatW + seatW / 2;
                const cy = rowY;
                const isSelected = selectedSeatIds.has(seat.id);
                const isSold = soldSeatIds.has(seat.id);
                const isSelectable = selectableSeatIds ? selectableSeatIds.has(seat.id) : true;
                const isUnavailable = !isSold && !isSelectable;
                const isHovered = hoveredSeatId === seat.id;
                return (
                  <g
                    key={seat.id}
                    style={{ cursor: isSold || isUnavailable ? "not-allowed" : "pointer" }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={seatSize / 2}
                      fill={
                        isSold
                          ? "#334155"
                          : isUnavailable
                          ? "#cbd5e1"
                          : isSelected || isHovered
                          ? "#bbf7d0"
                          : "#bae6fd"
                      }
                      stroke={
                        isSold
                          ? "#0f172a"
                          : isUnavailable
                          ? "#94a3b8"
                          : isSelected || isHovered
                          ? "#86efac"
                          : "#93c5fd"
                      }
                      strokeWidth={1.5}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => !isSold && !isUnavailable && onSeatToggle(seat.id)}
                      onMouseEnter={() => !isSold && !isUnavailable && setHoveredSeatId(seat.id)}
                      onMouseLeave={() => setHoveredSeatId((prev) => (prev === seat.id ? null : prev))}
                    >
                      <title>{seatTitleById?.get(seat.id) || `${seatLabelWord} ${seat.seat_label}`}</title>
                    </circle>
                  </g>
                );
              })}
                </g>
              );
            })}
          </g>
        );
      })}
      {/* Sahne */}
      <rect x={stageX} y={pad} width={stageW} height={stageH} rx={4} fill="#1e293b" />
      <text
        x={stageX + stageW / 2}
        y={pad + stageH / 2 + 5}
        textAnchor="middle"
        fill="#94a3b8"
        fontSize={14}
        fontWeight={600}
      >
        {stageLabel}
      </text>
    </svg>
  );
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

/** Eventim tarzı: salon planını büyük alan içinde zoom/pan ile kullanılabilir yapar. Satılmış koltuklar dolu gösterilir. */
function SeatMapWithZoom({
  sections,
  selectedSeatIds,
  soldSeatIds,
  onSeatToggle,
  sectionColors,
  selectableSeatIds,
  seatTitleById,
  stageLabel,
  seatLabelWord,
}: {
  sections: SeatPlanSection[];
  selectedSeatIds: Set<string>;
  soldSeatIds: Set<string>;
  onSeatToggle: (seatId: string) => void;
  sectionColors: Map<string, string>;
  selectableSeatIds?: Set<string>;
  seatTitleById?: Map<string, string>;
  stageLabel: string;
  seatLabelWord: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const didMove = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setScale((s) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s + delta)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    didMove.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    setIsDragging(true);
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didMove.current = true;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleSeatClick = useCallback((seatId: string) => {
    onSeatToggle(seatId);
  }, [onSeatToggle]);

  useEffect(() => {
    if (!isDragging) return;
    const onUp = () => setIsDragging(false);
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) didMove.current = true;
      setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
    };
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
    };
  }, [isDragging]);

  const zoomIn = () => setScale((s) => Math.min(MAX_ZOOM, s + ZOOM_STEP));
  const zoomOut = () => setScale((s) => Math.max(MIN_ZOOM, s - ZOOM_STEP));
  const resetView = () => {
    setScale(1.2);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-600">Salon planı:</span>
        <button
          type="button"
          onClick={zoomIn}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          aria-label="Yakınlaştır"
        >
          + Büyüt
        </button>
        <button
          type="button"
          onClick={zoomOut}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          aria-label="Uzaklaştır"
        >
          − Küçült
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sıfırla
        </button>
        <span className="text-xs text-slate-500">
          Fare tekerleği ile zoom · Sürükleyerek hareket ettirin
        </span>
      </div>
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-slate-200 bg-white touch-none"
        style={{ minHeight: 420, maxHeight: "70vh", cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        onMouseUp={handleMouseUp}
        role="application"
        aria-label="Salon planı; zoom ve sürükleyerek koltuk seçin"
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            width: "100%",
            minHeight: 468,
            display: "flex",
            justifyContent: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <SeatMapSvg
            sections={sections}
            selectedSeatIds={selectedSeatIds}
            soldSeatIds={soldSeatIds}
            onSeatToggle={handleSeatClick}
            sectionColors={sectionColors}
            selectableSeatIds={selectableSeatIds}
            seatTitleById={seatTitleById}
            stageLabel={stageLabel}
            seatLabelWord={seatLabelWord}
          />
        </div>
      </div>
    </div>
  );
}

/** Bilet açıklamasındaki "Min. X adet." ifadesinden minimum adedi döndürür (grup indirimli bilet). */
function getMinQuantityFromDescription(description: string | null | undefined): number {
  if (!description) return 1;
  const m = description.match(/Min\.\s*(\d+)\s*adet/i);
  const n = m ? parseInt(m[1], 10) : 0;
  return n > 0 ? n : 1;
}

export default function EventDetailClient({ event, tickets, venue = null, organizerDisplayName = null, locale: localeProp = "tr", isUnapproved = false }: EventDetailClientProps): React.ReactElement {
  const t = useTranslations("eventDetail");
  const tCheckout = useTranslations("checkout");
  const tCat = useTranslations("categories");
  const locale = (useLocale() as "tr" | "de" | "en") || localeProp;
  const searchParams = useSearchParams();
  const showSeatGridDebug = searchParams.get("seatDebug") === "1";
  const { addItem, removeSeatItem, totalItems } = useCart();

  const [ticketState, setTicketState] = useState<EventTicket[]>(tickets);
  const availableTickets = ticketState.filter((ticket) => Number(ticket.available || 0) > 0);
  const hasSeatingPlan = !!(event as Event & { seating_plan_id?: string }).seating_plan_id;
  const localized = useMemo(() => getLocalizedEvent(event as unknown as Record<string, unknown>, locale), [event, locale]);
  const parsedDescription = useMemo(() => parseEventDescription(localized.description || event.description), [localized.description, event.description]);
  const externalTicketUrl = parsedDescription.externalTicketUrl || (event as Event & { ticket_url?: string }).ticket_url || "";
  const isExternalOnlyEvent = Boolean(externalTicketUrl) && availableTickets.length === 0;
  const [selectedTicketType, setSelectedTicketType] = useState<string>(
    availableTickets[0]?.id || ""
  );
  const [ticketCount, setTicketCount] = useState<number>(1);
  /** Faz 1: Fiyat kategorisine göre (mevcut) / Yer seçerek (oturum planı varsa) */
  const [bookingMode, setBookingMode] = useState<"price" | "seat">(() =>
    !!(event as Event & { seating_plan_id?: string }).seating_plan_id ? "seat" : "price"
  );
  const [isFavorite, setIsFavorite] = useState(false);
  /** Koltuk seçimi: yüklü plan yapısı (bölüm > sıra > koltuk) */
  const [seatingPlanData, setSeatingPlanData] = useState<SeatPlanSection[] | null>(null);
  const [seatingPlanName, setSeatingPlanName] = useState("");
  const [seatingPlanLoading, setSeatingPlanLoading] = useState(false);
  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set());
  /** Satılmış koltuklar (completed siparişlerdeki order_seats) – salon planında dolu gösterilir, seçilemez */
  const [soldSeatIds, setSoldSeatIds] = useState<Set<string>>(new Set());
  /** Eventim tarzı: "list" = liste görünümü, "map" = salon planı (şematik) */
  const [seatMapView, setSeatMapView] = useState<"list" | "map">("map");
  const [selectedSeatCategory, setSelectedSeatCategory] = useState<string>("all");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  /** Yer seçerek bilet al akışında, seçilen koltuklar sepete eklendi mi? (sidebar mesajını değiştirmek için) */
  const [hasSeatSelectionAddedToCart, setHasSeatSelectionAddedToCart] = useState(false);
  /** Koltuk geçici rezervasyonları için anonim oturum kimliği */
  const [seatHoldSessionId, setSeatHoldSessionId] = useState<string | null>(null);
  const [venueFaqOpen, setVenueFaqOpen] = useState(false);
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderPending, setReminderPending] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ success: boolean; message: string } | null>(null);
  /** Site ayarı: sipariş başına max bilet (varsayılan 10) */
  const [maxTicketsPerOrder, setMaxTicketsPerOrder] = useState(10);
  const stageLabel = locale === "de" ? "Bühne" : locale === "en" ? "Stage" : "Sahne";
  const rowLabelWord = locale === "de" ? "Reihe" : locale === "en" ? "Row" : "Sıra";
  const seatLabelWord = locale === "de" ? "Platz" : locale === "en" ? "Seat" : "Koltuk";
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.maxTicketQuantity === "number") {
          setMaxTicketsPerOrder(Math.max(1, Math.min(100, data.maxTicketQuantity)));
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    const id = ensureSeatHoldSessionId(null);
    if (id) setSeatHoldSessionId(id);
  }, []);
  const selectedTicket = availableTickets.find((t) => t.id === selectedTicketType);
  const selectedMinQ = selectedTicket ? getMinQuantityFromDescription(selectedTicket.description) : 1;
  const selectedMaxQ = selectedTicket
    ? Math.min(Number(selectedTicket.available || 0), maxTicketsPerOrder)
    : 1;
  const totalPrice = selectedTicket ? selectedTicket.price * ticketCount : 0;

  // Grup biletinde adet minimumun altındaysa yukarı çek (sayfa ilk yüklendiğinde veya bilet türü değişince)
  useEffect(() => {
    const minQ = Math.min(selectedMinQ, selectedMaxQ);
    if (minQ > 1 && ticketCount < minQ) setTicketCount(minQ);
  }, [selectedTicketType, selectedMinQ, selectedMaxQ]);

  const seatingPlanId = (event as Event & { seating_plan_id?: string }).seating_plan_id;

  /** Ara render’da Musensaal şablonu “kapalı” kalıp planın kaybolması engellenir (state yerine veriden türetilir). */
  const isMusensaalPlan = useMemo(() => {
    if (!seatingPlanData?.length) return false;
    return planSectionsMatchMusensaalTemplate(seatingPlanData);
  }, [seatingPlanData]);

  const isImagePlan = useMemo(() => {
    return (
      isTheaterDuisburgVisualPlanName(seatingPlanName) ||
      seatingPlanSectionsMatchTheaterDuisburgTemplate(seatingPlanData)
    );
  }, [seatingPlanName, seatingPlanData]);

  const showDuisburgVisualHint =
    seatMapView === "map" &&
    !isMusensaalPlan &&
    !isImagePlan &&
    !!seatingPlanData?.length &&
    seatingPlanLooksLikeGermanTheaterButNotImage(seatingPlanData);

  useEffect(() => {
    if (!seatingPlanId || bookingMode !== "seat") {
      setSeatingPlanData(null);
      setSeatingPlanName("");
      setSeatingPlanLoading(false);
      return;
    }
    let cancelled = false;
    setSeatingPlanLoading(true);
    setSelectedSeatIds(new Set());
    (async () => {
      try {
        const [planRes, sectionsRes] = await Promise.all([
          supabase.from("seating_plans").select("name").eq("id", seatingPlanId).single(),
          supabase.from("seating_plan_sections").select("id, name, ticket_type_label").eq("seating_plan_id", seatingPlanId).order("sort_order"),
        ]);
        if (cancelled) return;
        const sections = sectionsRes.data;
        const planName = (planRes.data as { name?: string } | null)?.name ?? "";
        setSeatingPlanName(planName);
        if (!sections?.length) {
          if (!cancelled) setSeatingPlanData([]);
          return;
        }
        const { data: rows } = await supabase
          .from("seating_plan_rows")
          .select("id, section_id, row_label, ticket_type_label")
          .in("section_id", sections.map((s) => s.id))
          .order("section_id")
          .order("sort_order")
          .range(0, 4999);
        if (cancelled) return;
        if (!rows?.length) {
          if (!cancelled) {
            setSeatingPlanData(sections.map((s) => ({ ...s, rows: [] })));
          }
          return;
        }
        const { data: seats } = await supabase
          .from("seats")
          .select("id, row_id, seat_label")
          .in("row_id", rows.map((r) => r.id))
          .range(0, 19999);
        if (cancelled) return;
        const rowsBySection = new Map<string, SeatPlanRow[]>();
        rows.forEach((r) => {
          const list = rowsBySection.get(r.section_id) || [];
          const rowSeats = (seats || [])
            .filter((s) => s.row_id === r.id)
            .map((s) => ({ id: s.id, seat_label: s.seat_label }))
            .sort((a, b) => {
              const na = Number(String(a.seat_label).trim());
              const nb = Number(String(b.seat_label).trim());
              const aNum = Number.isFinite(na);
              const bNum = Number.isFinite(nb);
              if (aNum && bNum) return na - nb;
              if (aNum && !bNum) return -1;
              if (!aNum && bNum) return 1;
              return String(a.seat_label).localeCompare(String(b.seat_label), undefined, { numeric: true, sensitivity: "base" });
            });
          list.push({
            id: r.id,
            row_label: r.row_label,
            ticket_type_label: (r as { ticket_type_label?: string | null }).ticket_type_label ?? null,
            seats: rowSeats,
          });
          rowsBySection.set(r.section_id, list);
        });
        const result: SeatPlanSection[] = sections.map((s) => {
          const sectionRows = rowsBySection.get(s.id) || [];
          const sorted = [...sectionRows].sort((a, b) => {
            const na = Number(a.row_label);
            const nb = Number(b.row_label);
            if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
            return String(a.row_label).localeCompare(String(b.row_label));
          });
          return {
            id: s.id,
            name: s.name,
            ticket_type_label: (s as { ticket_type_label?: string }).ticket_type_label ?? null,
            rows: sorted,
          };
        });
        if (!cancelled) setSeatingPlanData(result);
      } finally {
        if (!cancelled) setSeatingPlanLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seatingPlanId, bookingMode]);

  const fetchSoldSeats = useCallback(() => {
    if (!event?.id || !hasSeatingPlan) return;
    fetch(`/api/sold-seats?event_id=${encodeURIComponent(event.id)}`)
      .then((r) => r.json())
      .then((data) => {
        const ids = Array.isArray(data?.seatIds) ? data.seatIds : [];
        setSoldSeatIds(new Set(ids));
      })
      .catch(() => setSoldSeatIds(new Set()));
  }, [event?.id, hasSeatingPlan]);

  useEffect(() => {
    fetchSoldSeats();
  }, [fetchSoldSeats]);

  useEffect(() => {
    if (!event?.id || !hasSeatingPlan) return;
    const onFocus = () => fetchSoldSeats();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [event?.id, hasSeatingPlan, fetchSoldSeats]);

  const musensaalIdMaps = useMemo(() => {
    if (!isMusensaalPlan || !seatingPlanData?.length) return null;
    return buildMusensaalIdMaps(seatingPlanData);
  }, [isMusensaalPlan, seatingPlanData]);

  const imagePlanSeats = useMemo(() => {
    if (!seatingPlanData?.length || !isImagePlan) return [];
    return buildTheaterDuisburgSeatItemsWithCoords(seatingPlanData);
  }, [seatingPlanData, isImagePlan]);

  const duisburgSeatCaptionById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of imagePlanSeats) {
      m.set(s.id, s.venue_caption);
    }
    return m;
  }, [imagePlanSeats]);

  const sectionColorMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!seatingPlanData?.length) return m;
    seatingPlanData.forEach((section, idx) => {
      const { ticket } = getTicketForSection(section, idx, availableTickets);
      const label = String(section.ticket_type_label || ticket.name || section.name || "");
      m.set(section.id, getCategoryColorHex(label));
    });
    return m;
  }, [seatingPlanData, availableTickets]);

  const seatMetaById = useMemo(() => {
    const seatToSection = new Map<string, SeatPlanSection>();
    const seatToRow = new Map<string, SeatPlanRow>();
    seatingPlanData?.forEach((sec) =>
      sec.rows.forEach((row) =>
        row.seats.forEach((seat) => {
          seatToSection.set(seat.id, sec);
          seatToRow.set(seat.id, row);
        })
      )
    );
    const meta = new Map<string, { ticket: TicketLike; venueLine: string }>();
    seatToSection.forEach((sec, seatId) => {
      const row = seatToRow.get(seatId);
      const st = sec.rows.flatMap((r) => r.seats).find((s) => s.id === seatId);
      const secIdx = seatingPlanData ? seatingPlanData.indexOf(sec) : 0;
      const { ticket } = getTicketForRow(sec, row, secIdx, availableTickets);
      const fallbackLine = `${sec?.name ?? "—"} · ${rowLabelWord} ${row?.row_label ?? "—"} · ${seatLabelWord} ${st?.seat_label ?? "—"}`;
      meta.set(seatId, {
        ticket,
        venueLine: duisburgSeatCaptionById.get(seatId) ?? fallbackLine,
      });
    });
    return meta;
  }, [seatingPlanData, availableTickets, duisburgSeatCaptionById]);

  const seatCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    seatMetaById.forEach((meta) => {
      const name = String(meta.ticket?.name || "").trim();
      if (name) set.add(name);
    });
    return Array.from(set);
  }, [seatMetaById]);

  const selectableSeatIdsByCategory = useMemo(() => {
    if (selectedSeatCategory === "all") return undefined;
    const ids = new Set<string>();
    seatMetaById.forEach((meta, seatId) => {
      const tName = String(meta.ticket?.name || "").trim();
      if (tName === selectedSeatCategory) ids.add(seatId);
    });
    return ids;
  }, [seatMetaById, selectedSeatCategory]);

  const seatTitleById = useMemo(() => {
    const m = new Map<string, string>();
    seatMetaById.forEach((meta, seatId) => {
      const price = formatPrice(Number(meta.ticket?.price || 0), event.currency);
      m.set(seatId, `${meta.venueLine} · ${meta.ticket?.name || "Bilet"} · ${price}`);
    });
    return m;
  }, [seatMetaById, event.currency]);

  const handleSeatToggle = useCallback(
    async (seatId: string) => {
      const sessionId = ensureSeatHoldSessionId(seatHoldSessionId);
      if (!sessionId) return;
      if (sessionId !== seatHoldSessionId) setSeatHoldSessionId(sessionId);
      const isSelected = selectedSeatIds.has(seatId);

      if (isSelected) {
        setSelectedSeatIds((prev) => {
          const next = new Set(prev);
          next.delete(seatId);
          return next;
        });
        removeSeatItem(event.id, seatId);
        try {
          await fetch("/api/seat-holds", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: event.id, seatId, sessionId }),
          });
        } catch {
          /* ignore */
        }
        return;
      }

      if (selectedSeatIds.size >= maxTicketsPerOrder) {
        setActionMessage(
          locale === "de"
            ? `Max. ${maxTicketsPerOrder} Platze pro Bestellung.`
            : locale === "en"
            ? `Maximum ${maxTicketsPerOrder} tickets per order.`
            : `Siparis basina en fazla ${maxTicketsPerOrder} bilet alabilirsiniz.`
        );
        return;
      }
      try {
        if (selectableSeatIdsByCategory && !selectableSeatIdsByCategory.has(seatId)) return;
        const res = await fetch("/api/seat-holds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seatId, eventId: event.id, sessionId }),
        });
        if (!res.ok) {
          setActionMessage(
            locale === "de"
              ? "Der gewahlte Platz ist leider bereits verkauft oder reserviert."
              : locale === "en"
              ? "The selected seat is unfortunately already sold or reserved."
              : "Sectiginiz bilet maalesef satildi."
          );
          return;
        }
        setSelectedSeatIds((prev) => {
          const next = new Set(prev);
          next.add(seatId);
          return next;
        });
        const seatMeta = seatMetaById.get(seatId);
        const fallbackTicket = availableTickets.find((t) => t.id === selectedTicketType) || availableTickets[0];
        const ticketForCart = seatMeta?.ticket?.id ? seatMeta.ticket : fallbackTicket;
        if (ticketForCart?.id) {
          addItem({
            ticketId: ticketForCart.id,
            eventId: event.id,
            eventTitle: localized.title || event.title,
            eventDate: event.date,
            eventTime: event.time || "20:00",
            venue: localized.venue || event.venue,
            location: event.location,
            imageUrl: event.image_url,
            ticketName: ticketForCart.name || "Bilet",
            price: Number(ticketForCart.price || 0),
            currency: event.currency,
            eventCheckoutFee:
              typeof event.checkout_processing_fee === "number" &&
              event.checkout_processing_fee > 0
                ? event.checkout_processing_fee
                : undefined,
            quantity: 1,
            available: Number(ticketForCart.available || 0),
            seatIds: [seatId],
            seatCaptions: [seatMeta?.venueLine || seatId],
          });
          setHasSeatSelectionAddedToCart(true);
          setActionMessage(tCheckout("addedToCart"));
        }
      } catch {
        setActionMessage(
          locale === "de"
            ? "Platz konnte nicht reserviert werden."
            : locale === "en"
            ? "Could not reserve the seat."
            : "Koltuk rezerve edilemedi."
        );
      }
    },
    [
      addItem,
      availableTickets,
      event,
      locale,
      localized.title,
      maxTicketsPerOrder,
      removeSeatItem,
      seatHoldSessionId,
      seatMetaById,
      selectableSeatIdsByCategory,
      selectedSeatIds,
      selectedTicketType,
      tCheckout,
    ]
  );

  const eventDateTime = new Date(`${event.date} ${event.time || "23:59"}`);
  const isPastEvent = eventDateTime < new Date();

  async function handleReminderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reminderEmail.trim()) return;
    setReminderPending(true);
    setReminderResult(null);
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: reminderEmail.trim(), event_id: event.id }),
      });
      const data = await res.json();
      setReminderResult({ success: data.success, message: data.message || t("actionFailed") });
      if (data.success) setReminderEmail("");
    } catch {
      setReminderResult({ success: false, message: t("actionFailed") });
    } finally {
      setReminderPending(false);
    }
  }

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("favorite_events");
      const favorites = stored ? (JSON.parse(stored) as string[]) : [];
      setIsFavorite(favorites.includes(event.id));
    } catch {
      setIsFavorite(false);
    }
  }, [event.id]);

  // Huni analitiği: etkinlik görüntüleme
  useEffect(() => {
    let sid = "";
    let heroVariant: string | undefined;
    try {
      sid = sessionStorage.getItem("analytics_session") || "";
      if (!sid) {
        sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        sessionStorage.setItem("analytics_session", sid);
      }
      const hv = sessionStorage.getItem("hero_ab_variant");
      if (hv) {
        const parsed = JSON.parse(hv) as { variant?: string };
        heroVariant = parsed?.variant;
      }
    } catch {
      /* ignore */
    }
    fetch("/api/analytics/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "view",
        event_id: event.id,
        session_id: sid || undefined,
        hero_variant: heroVariant,
      }),
    }).catch(() => {});
  }, [event.id]);

  async function toggleFavorite() {
    const stored = window.localStorage.getItem("favorite_events");
    const favorites = stored ? (JSON.parse(stored) as string[]) : [];
    const alreadyFavorite = favorites.includes(event.id);
    const action = alreadyFavorite ? "remove" : "add";

    try {
      let sessionId = "";
      try {
        sessionId = sessionStorage.getItem("follow_session") || "";
        if (!sessionId) {
          sessionId = `fs_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
          sessionStorage.setItem("follow_session", sessionId);
        }
      } catch {
        /* ignore */
      }
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/event-favorite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          event_id: event.id,
          action,
          session_id: sessionId || undefined,
        }),
      });
      const data = await res.json();
      if (!data.success && res.status >= 400) {
        throw new Error(data.message || "İşlem başarısız");
      }

      const next = alreadyFavorite
        ? favorites.filter((id) => id !== event.id)
        : [...favorites, event.id];
      window.localStorage.setItem("favorite_events", JSON.stringify(next));
      setIsFavorite(!alreadyFavorite);
      setActionMessage(alreadyFavorite ? t("removedFromFavorites") : t("addedToFavorites"));
      window.setTimeout(() => setActionMessage(null), 2200);
    } catch {
      setActionMessage(t("actionFailed"));
      window.setTimeout(() => setActionMessage(null), 2200);
    }
  }

  async function handleShare() {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: localized.title,
          text: t("shareEventText", { title: localized.title }),
          url: shareUrl,
        });
        setActionMessage(t("shareOpened"));
        window.setTimeout(() => setActionMessage(null), 2200);
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setActionMessage(t("linkCopied"));
      window.setTimeout(() => setActionMessage(null), 2200);
    } catch {
      setActionMessage(t("shareFailed"));
      window.setTimeout(() => setActionMessage(null), 2200);
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <Header />
      
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            {tCat((event.category || "diger").toLowerCase())}
          </p>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900">{localized.title}</h1>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-700">
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatEventDateDMY(event.date)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5">
                  <Clock className="h-4 w-4" />
                  {event.time}
                </span>
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5">
                  <MapPin className="h-4 w-4" />
                  {localized.venue || event.venue}
                </span>
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5">
                  <MapPin className="h-4 w-4" />
                  {event.location || localized.venue || event.venue}
                </span>
                {organizerDisplayName && (
                  <span className="inline-flex items-center gap-2 rounded-md bg-primary-50 px-3 py-1.5 text-primary-700">
                    <Building2 className="h-4 w-4" />
                    {t("organizer")}: {organizerDisplayName}
                  </span>
                )}
              </div>
              <div className="mt-5">
                <p className="text-sm text-slate-600">{t("tickets")}</p>
                <p className="text-2xl font-bold text-primary-700">
                  {availableTickets.length > 0
                    ? `${t("from")} ${formatPrice(Math.min(...availableTickets.map((t) => Number(t.price || 0))), event.currency)}`
                    : isExternalOnlyEvent
                      ? `${t("from")} ${formatPrice(Number(event.price_from || 0), event.currency)}`
                      : t("comingSoon")}
                </p>
              </div>
            </div>

            <div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {event.image_url ? (
                  <Image
                    src={event.image_url}
                    alt={localized.title}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 360px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Ticket className="h-16 w-16 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={toggleFavorite}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Heart className="h-4 w-4" />
                  {isFavorite ? t("favorited") : t("favorite")}
                </button>
                <button
                  onClick={handleShare}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Share2 className="h-4 w-4" />
                  {t("share")}
                </button>
              </div>
              {actionMessage && <p className="mt-2 text-xs text-slate-500">{actionMessage}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section - full width, no sidebar */}
      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <div>
          {/* Bilet Seçimi - geniş alan */}
          <div
            id="event-ticket-booking"
            className="scroll-mt-24 bg-white rounded-xl border border-slate-200 p-4 sm:p-6 lg:p-8"
          >
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-4 sm:mb-6 border-b border-slate-100 pb-3">
                {isExternalOnlyEvent ? t("ticketInfo") : t("ticketSelection")}
              </h2>

              {isUnapproved && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <p className="font-medium">Bu etkinlik onay bekliyor</p>
                  <p className="mt-1 text-sm">Yönetici onayından sonra sitede yayına alınacak ve bilet satışı açılacaktır. Bu sayfa sadece önizleme içindir.</p>
                </div>
              )}

              {/* Bestplatzbuchung / Saalplanbuchung – ikonlu seçim */}
              {!isExternalOnlyEvent && (
                <div className="mb-8 grid sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setBookingMode("price")}
                    className={`rounded-2xl border-2 p-6 text-left transition-all flex gap-4 items-start ${
                      bookingMode === "price"
                        ? "border-primary-500 bg-primary-50/80 text-primary-900 shadow-md shadow-primary-200/50"
                        : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <span className={`flex-shrink-0 rounded-xl p-3 ${bookingMode === "price" ? "bg-primary-100 text-primary-600" : "bg-slate-200 text-slate-500"}`}>
                      <Armchair className="h-10 w-10" />
                    </span>
                    <div className="min-w-0">
                      <span className="block font-bold text-lg">{t("bestplatzbuchung")}</span>
                      <span className="mt-1 block text-sm opacity-90">{t("bestplatzbuchungDesc")}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingMode("seat")}
                    className={`rounded-2xl border-2 p-6 text-left transition-all flex gap-4 items-start ${
                      bookingMode === "seat"
                        ? "border-primary-500 bg-primary-50/80 text-primary-900 shadow-md shadow-primary-200/50"
                        : "border-slate-200 bg-slate-50/50 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    <span className={`flex-shrink-0 rounded-xl p-3 ${bookingMode === "seat" ? "bg-primary-100 text-primary-600" : "bg-slate-200 text-slate-500"}`}>
                      <LayoutGrid className="h-10 w-10" />
                    </span>
                    <div className="min-w-0">
                      <span className="block font-bold text-lg">{t("saalplanbuchung")}</span>
                      <span className="mt-1 block text-sm opacity-90">{t("saalplanbuchungDesc")}</span>
                    </div>
                  </button>
                </div>
              )}

              {isExternalOnlyEvent && (
                <div className="mb-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
                  <p className="text-sm text-blue-900 mb-4">
                    {t("externalTicketInfo")}{" "}
                    {t("priceFrom")}: <strong>{formatPrice(Number(event.price_from || 0), event.currency)}</strong>
                  </p>
                  <p className="text-sm text-blue-800 mb-3">
                    {t("externalTicketDisclaimer")}
                  </p>
                  <p className="text-sm text-blue-800 mb-4">
                    {t("externalTicketDisclaimer2")} {t("externalTicketSupport")}
                  </p>
                  <a
                    href={externalTicketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    {t("buyExternal")}
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              )}

              {/* Yer seçerek: oturum planı varsa koltuk listesi, yoksa bilgi mesajı */}
              {!isExternalOnlyEvent && bookingMode === "seat" && !hasSeatingPlan && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
                  <p className="font-medium">Bu etkinlik için koltuk seçimi tanımlanmamış.</p>
                  <p className="mt-2 text-sm">Bilet almak için &quot;Fiyat kategorisine göre bilet al&quot; seçeneğini kullanabilirsiniz.</p>
                  <p className="mt-3 text-xs text-slate-500">
                    Koltuk seçimini açmak için: Yönetim → Etkinlikler → bu etkinliği düzenle → Mekan seçin, &quot;Oturum planı&quot; alanından bir plan seçip kaydedin.
                  </p>
                </div>
              )}
              {!isExternalOnlyEvent && bookingMode === "seat" && hasSeatingPlan && (
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  {seatingPlanLoading && (!seatingPlanData || seatingPlanData.length === 0) ? (
                    <p className="text-slate-500">Salon planı yükleniyor...</p>
                  ) : seatingPlanData && seatingPlanData.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                      {/* Sol: Plan + harita/liste */}
                      <div className="min-w-0">
                        {availableTickets.length === 0 ? (
                          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                            <strong>Bilet stoku yok.</strong> Koltukları işaretleyebilirsiniz; sepete eklemek için yönetimde bu etkinlik için en az bir bilet türü tanımlayıp adedi 0&apos;dan büyük yapın.
                          </div>
                        ) : (
                          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <p className="font-semibold text-slate-800 mb-2">Satıştaki bilet türleri (bölüm etiketi veya sıra ile eşleşir)</p>
                            <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
                              {availableTickets.map((tk) => (
                                <li key={tk.id}>
                                  <span className="font-medium text-slate-800">{tk.name || "Bilet"}</span>
                                  <span className="text-slate-500"> · </span>
                                  {formatPrice(Number(tk.price || 0), event.currency)}
                                  <span className="text-slate-500"> ({tk.available} kalan)</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p className="text-sm text-slate-600 mb-3">Bölüm ve koltuk seçin. Her bölümün fiyatı, etkinlikte tanımlı bilet türü adıyla eşleşir.</p>
                        <div className="flex gap-2 mb-4">
                          <button
                            type="button"
                            onClick={() => setSeatMapView("map")}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${seatMapView === "map" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                          >
                            Salon planı
                          </button>
                          <button
                            type="button"
                            onClick={() => setSeatMapView("list")}
                            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${seatMapView === "list" ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                          >
                            Liste
                          </button>
                          <select
                            value={selectedSeatCategory}
                            onChange={(e) => setSelectedSeatCategory(e.target.value)}
                            className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                            aria-label="Alle Kategorien"
                          >
                            <option value="all">Alle Kategorien</option>
                            {seatCategoryOptions.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {seatMapView === "map" && (
                          <div className="mb-4">
                            {isMusensaalPlan && musensaalIdMaps && getPlan("musensaal") ? (
                              <SalonPlanViewer
                                plan={getPlan("musensaal")!}
                                selectedIds={new Set(
                                  Array.from(selectedSeatIds).map((id) => musensaalIdMaps.dbIdToLogical.get(id)).filter(Boolean) as string[]
                                )}
                                soldIds={new Set(
                                  Array.from(soldSeatIds).map((id) => musensaalIdMaps.dbIdToLogical.get(id)).filter(Boolean) as string[]
                                )}
                                selectableIds={new Set(musensaalIdMaps.logicalToDbId.keys())}
                                onToggle={(logicalId) => {
                                  const dbId = musensaalIdMaps.logicalToDbId.get(logicalId);
                                  if (!dbId) return;
                                  void handleSeatToggle(dbId);
                                }}
                              />
                            ) : isImagePlan ? (
                              <ImageSeatPlanViewer
                                imageUrl={theaterduisburgImagePlan.imageUrl}
                                imageAspectRatio={THEATER_DUISBURG_IMAGE_ASPECT}
                                viewBoxWidth={THEATER_DUISBURG_VIEWBOX_W}
                                seatDiameterViewUnits={8.4}
                                planSections={theaterduisburgImagePlan.sections}
                                showSeatGridDebug={showSeatGridDebug}
                                seats={imagePlanSeats}
                                getCoord={getTheaterDuisburgCoord}
                                selectedSeatIds={selectedSeatIds}
                                soldSeatIds={soldSeatIds}
                                onSeatToggle={(seatId) => void handleSeatToggle(seatId)}
                              />
                            ) : (
                              <>
                              {showDuisburgVisualHint ? (
                                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                                  <strong>Vektör plan</strong> görünüyor (daireler / basit şekil).{" "}
                                  <strong>Theater Duisburg SVG</strong> için oturum planı adında{" "}
                                  <code className="rounded bg-white/80 px-1">Duisburg</code> veya{" "}
                                  <code className="rounded bg-white/80 px-1">Theater Duisburg</code>{" "}
                                  kullanın — ya da mekanda Duisburg şablonundaki 12 bölümün tamamı olsun; o zaman
                                  görsel plan otomatik açılır. Sayfa:{" "}
                                  <code className="rounded bg-white/80 px-1">/tr/etkinlik/…</code> →{" "}
                                  <strong>Koltuk seç</strong> → <strong>Salon planı</strong>.
                                </p>
                              ) : null}
                              <SeatMapWithZoom
                                sections={seatingPlanData}
                                selectedSeatIds={selectedSeatIds}
                                soldSeatIds={soldSeatIds}
                                onSeatToggle={(seatId) => void handleSeatToggle(seatId)}
                                sectionColors={sectionColorMap}
                                selectableSeatIds={selectableSeatIdsByCategory}
                                seatTitleById={seatTitleById}
                                stageLabel={stageLabel}
                                seatLabelWord={seatLabelWord}
                              />
                              <p className="mt-2 text-xs text-slate-500">
                                Bu görünüm, yönetim panelinde tanımladığınız bölüm / sıra / koltuk verisine göredir (Rosengarten Musensaal çizimi değildir).
                              </p>
                              </>
                            )}
                          </div>
                        )}
                        {seatMapView === "list" && (
                          <div className="space-y-4 max-h-[400px] overflow-y-auto">
                            {seatingPlanData.map((section, sectionIdx) => {
                              const { ticket: sectionTicket, matchedBy } = getTicketForSection(section, sectionIdx, availableTickets);
                              return (
                                <div key={section.id} className="border border-slate-200 rounded-lg p-4">
                                  <h4 className="font-semibold text-slate-900 mb-1">{section.name}</h4>
                                  <p className="text-sm text-primary-600 mb-2">
                                    {formatPrice(Number(sectionTicket.price || 0), event.currency)} / koltuk
                                    {matchedBy === "index" && section.ticket_type_label && (
                                      <span className="ml-2 text-xs text-slate-500">({section.ticket_type_label} → {sectionTicket.name || "—"})</span>
                                    )}
                                  </p>
                                  {section.rows.map((row) => (
                                    <div key={row.id} className="flex flex-wrap items-center gap-2 mb-2">
                                      <span className="text-sm font-medium text-slate-600 w-16">{rowLabelWord} {row.row_label}</span>
                                      <div className="flex flex-wrap gap-1">
                                        {row.seats.map((seat) => {
                                          const isSelected = selectedSeatIds.has(seat.id);
                                          const isSold = soldSeatIds.has(seat.id);
                                          const handleClick = async () => {
                                            if (isSold) return;
                                            await handleSeatToggle(seat.id);
                                          };
                                          return (
                                            <button
                                              key={seat.id}
                                              type="button"
                                              disabled={isSold || (selectableSeatIdsByCategory ? !selectableSeatIdsByCategory.has(seat.id) : false)}
                                              onClick={handleClick}
                                              className={`w-9 h-9 rounded text-sm font-medium transition-colors ${
                                                isSold
                                                  ? "bg-slate-600 text-slate-200 cursor-not-allowed ring-1 ring-slate-700"
                                                  : selectableSeatIdsByCategory && !selectableSeatIdsByCategory.has(seat.id)
                                                    ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                                                  : isSelected
                                                    ? "bg-green-200 text-slate-900"
                                                    : "bg-sky-200 text-slate-800 hover:bg-green-200"
                                              } ${!isSelected && !isSold && selectedSeatIds.size >= maxTicketsPerOrder ? "opacity-50 cursor-not-allowed" : ""}`}
                                              title={seatTitleById.get(seat.id) || (isSold ? `${seat.seat_label} (satıldı)` : undefined)}
                                            >
                                              {seat.seat_label}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* Sağ: Deine Platze sidebar */}
                      <aside className="lg:sticky lg:top-6 self-start rounded-xl border border-slate-200 bg-slate-50/80 p-4 h-fit">
                        <h3 className="text-sm font-bold text-slate-800 mb-3">{t("deinePlatze")}</h3>
                        {selectedSeatIds.size > 0 && seatingPlanData ? (
                          availableTickets.length > 0 ? (() => {
                          const seatToSection = new Map<string, SeatPlanSection>();
                          const seatToRow = new Map<string, SeatPlanRow>();
                          seatingPlanData.forEach((sec) =>
                            sec.rows.forEach((row) =>
                              row.seats.forEach((seat) => {
                                seatToSection.set(seat.id, sec);
                                seatToRow.set(seat.id, row);
                              })
                            )
                          );
                          let totalCents = 0;
                          selectedSeatIds.forEach((seatId) => {
                            const sec = seatToSection.get(seatId);
                            const row = seatToRow.get(seatId);
                            const sectionIdx = sec ? seatingPlanData.indexOf(sec) : 0;
                            const { ticket: tk } = getTicketForRow(sec ?? { id: "", name: "", rows: [] }, row, sectionIdx, availableTickets);
                            totalCents += Number(tk.price || 0) * 100;
                          });
                          const totalPrice = totalCents / 100;
                          const selectedSeatsList = Array.from(selectedSeatIds).map((seatId) => {
                            const sec = seatToSection.get(seatId);
                            const row = seatToRow.get(seatId);
                            const seat = sec?.rows.flatMap((r) => r.seats).find((s) => s.id === seatId);
                            const sectionIdx = sec ? seatingPlanData.indexOf(sec) : 0;
                            const { ticket: tk } = getTicketForRow(sec ?? { id: "", name: "", rows: [] }, row, sectionIdx, availableTickets);
                            const fallbackLine = `${sec?.name ?? "—"} · ${rowLabelWord} ${row?.row_label ?? "—"} · ${seatLabelWord} ${seat?.seat_label ?? "—"}`;
                            return {
                              seatId,
                              sectionName: sec?.name ?? "—",
                              rowLabel: row?.row_label ?? "—",
                              seatLabel: seat?.seat_label ?? "—",
                              venueLine: duisburgSeatCaptionById.get(seatId) ?? fallbackLine,
                              price: Number(tk.price || 0),
                              ticketName: tk.name || "Bilet",
                            };
                          });
                          const seatIdsByTicketId = new Map<string, string[]>();
                          selectedSeatIds.forEach((seatId) => {
                            const sec = seatToSection.get(seatId);
                            const row = seatToRow.get(seatId);
                            const sectionIdx = sec ? seatingPlanData.indexOf(sec) : 0;
                            const { ticket: tk } = getTicketForRow(sec ?? { id: "", name: "", rows: [] }, row, sectionIdx, availableTickets);
                            const arr = seatIdsByTicketId.get(tk.id) ?? [];
                            arr.push(seatId);
                            seatIdsByTicketId.set(tk.id, arr);
                          });
                          const atSeatLimit = selectedSeatIds.size >= maxTicketsPerOrder;
                          const processingFee =
                            typeof event.checkout_processing_fee === "number" && event.checkout_processing_fee > 0
                              ? Number(event.checkout_processing_fee)
                              : 0;
                          const grandTotal = totalPrice + processingFee;
                          return (
                            <>
                              <ul className="space-y-2 max-h-56 overflow-y-auto mb-4">
                                {selectedSeatsList.map((item) => (
                                  <li key={item.seatId} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-slate-100 px-3 py-2 text-sm shadow-sm">
                                    <span className="text-slate-700 truncate" title={item.venueLine}>
                                      {item.venueLine}
                                    </span>
                                    <span className="font-semibold text-primary-600 flex-shrink-0">{formatPrice(item.price, event.currency)}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleSeatToggle(item.seatId);
                                      }}
                                      className="text-slate-400 hover:text-red-600 p-1 flex-shrink-0"
                                      aria-label="Kaldır"
                                    >
                                      ×
                                    </button>
                                  </li>
                                ))}
                              </ul>
                              {atSeatLimit && (
                                <p className="text-xs text-amber-600 mb-2">
                                  {locale === "de" ? `Max. ${maxTicketsPerOrder} Plätze pro Bestellung.` : `Sipariş başına en fazla ${maxTicketsPerOrder} bilet.`}
                                </p>
                              )}
                              <div className="mb-3 space-y-1 text-sm text-slate-700">
                                <p>
                                  <strong>{selectedSeatIds.size}</strong>{" "}
                                  {locale === "de" ? "Platze Gewahlt" : locale === "en" ? "Seats Selected" : "Koltuk Seçildi"}{" "}
                                  <strong>{locale === "de" ? "Gesamt" : locale === "en" ? "Total" : "Toplam"} {formatPrice(totalPrice, event.currency)}</strong>
                                </p>
                                <p>
                                  {locale === "de" ? "Bearbeitungsgebuhr" : locale === "en" ? "Processing Fee" : "İşlem Ücreti"}{" "}
                                  <strong>{formatPrice(processingFee, event.currency)}</strong>
                                </p>
                                <p className="font-semibold text-slate-900">
                                  {locale === "de" ? "Gesamtsumme" : locale === "en" ? "Grand Total" : "Genel Toplam"}{" "}
                                  {formatPrice(grandTotal, event.currency)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isPastEvent || isUnapproved) return;
                                  const eventPayload = {
                                    eventId: event.id,
                                    eventTitle: localized.title || event.title,
                                    eventDate: event.date,
                                    eventTime: event.time || "20:00",
                                    venue: localized.venue || event.venue,
                                    location: event.location,
                                    imageUrl: event.image_url,
                                    currency: event.currency,
                                    eventCheckoutFee:
                                      typeof event.checkout_processing_fee === "number" &&
                                      event.checkout_processing_fee > 0
                                        ? event.checkout_processing_fee
                                        : undefined,
                                  };
                                  seatIdsByTicketId.forEach((seatIds, ticketId) => {
                                    const tk = availableTickets.find((x) => x.id === ticketId);
                                    if (!tk) return;
                                    const seatCaptions = seatIds.map(
                                      (id) =>
                                        duisburgSeatCaptionById.get(id) ??
                                        (() => {
                                          const sec = seatToSection.get(id);
                                          const row = seatToRow.get(id);
                                          const st = sec?.rows.flatMap((r) => r.seats).find((s) => s.id === id);
                                          return `${sec?.name ?? ""} · ${rowLabelWord} ${row?.row_label ?? ""} · ${seatLabelWord} ${st?.seat_label ?? id}`;
                                        })()
                                    );
                                    addItem({
                                      ...eventPayload,
                                      ticketId: tk.id,
                                      ticketName: tk.name || "Bilet",
                                      price: Number(tk.price || 0),
                                      quantity: seatIds.length,
                                      seatIds,
                                      seatCaptions,
                                      available: Number(tk.available || 0),
                                    });
                                  });
                                  setActionMessage(tCheckout("addedToCart"));
                                  setSelectedSeatIds(new Set());
                                  setHasSeatSelectionAddedToCart(true);
                                }}
                                disabled={isPastEvent || isUnapproved || selectedSeatIds.size > maxTicketsPerOrder}
                                className="w-full rounded-xl bg-primary-600 px-4 py-3 text-white font-semibold hover:bg-primary-700 disabled:opacity-50"
                              >
                                {tCheckout("addToCart")} ({selectedSeatIds.size})
                              </button>
                            </>
                          );
                        })() : (() => {
                          const seatToSection = new Map<string, SeatPlanSection>();
                          const seatToRow = new Map<string, SeatPlanRow>();
                          seatingPlanData.forEach((sec) =>
                            sec.rows.forEach((row) =>
                              row.seats.forEach((seat) => {
                                seatToSection.set(seat.id, sec);
                                seatToRow.set(seat.id, row);
                              })
                            )
                          );
                          const selectedSeatsList = Array.from(selectedSeatIds).map((seatId) => {
                            const sec = seatToSection.get(seatId);
                            const row = seatToRow.get(seatId);
                            const seat = sec?.rows.flatMap((r) => r.seats).find((s) => s.id === seatId);
                            const fallbackLine = `${sec?.name ?? "—"} · ${rowLabelWord} ${row?.row_label ?? "—"} · ${seatLabelWord} ${seat?.seat_label ?? "—"}`;
                            return {
                              seatId,
                              sectionName: sec?.name ?? "—",
                              rowLabel: row?.row_label ?? "—",
                              seatLabel: seat?.seat_label ?? "—",
                              venueLine: duisburgSeatCaptionById.get(seatId) ?? fallbackLine,
                            };
                          });
                          return (
                            <div className="space-y-3">
                              <p className="text-sm text-rose-800 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                                Satışta bilet yok; sepete eklenemez. Yönetimden bilet stoğu açın veya &quot;Fiyat kategorisine göre&quot; modunu kullanın.
                              </p>
                              <ul className="space-y-2 max-h-56 overflow-y-auto">
                                {selectedSeatsList.map((item) => (
                                  <li key={item.seatId} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-slate-100 px-3 py-2 text-sm shadow-sm">
                                    <span className="text-slate-700 truncate" title={item.venueLine}>
                                      {item.venueLine}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleSeatToggle(item.seatId);
                                      }}
                                      className="text-slate-400 hover:text-red-600 p-1 flex-shrink-0"
                                      aria-label="Kaldır"
                                    >
                                      ×
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })()
                        ) : (
                          hasSeatSelectionAddedToCart ? (
                            <div className="space-y-3 py-4">
                              <p className="text-sm text-slate-700">
                                {locale === "de"
                                  ? "Ihre ausgewählten Plätze wurden in den Warenkorb gelegt."
                                  : locale === "en"
                                  ? "Your selected seats have been added to the shopping cart."
                                  : "Seçtiğiniz koltuklar alışveriş sepetinize eklendi."}
                              </p>
                              <p className="text-xs text-slate-500">
                                {locale === "de"
                                  ? "Bitte gehen Sie zum Warenkorb, um Ihre Buchung abzuschließen."
                                  : locale === "en"
                                  ? "Please go to your shopping cart to complete the payment."
                                  : "Lütfen alışveriş sepetine gidip ödemenizi tamamlayın."}
                              </p>
                              <div className="flex flex-col gap-2">
                                <Link
                                  href={`/${locale}/sepet`}
                                  className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
                                >
                                  {locale === "de"
                                    ? "Zur Kasse"
                                    : locale === "en"
                                    ? "Proceed to checkout"
                                    : "Odemeye gec"}
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 py-4">
                              {locale === "de"
                                ? "Wählen Sie Plätze im Plan."
                                : locale === "en"
                                ? "Select seats from the seating plan."
                                : "Plandan koltuk seçin."}
                            </p>
                          )
                        )}
                      </aside>
                    </div>
                  ) : (
                    <p className="text-slate-500">Bu plan için henüz bölüm/sıra/koltuk tanımlanmamış.</p>
                  )}
                </div>
              )}

              {/* Bilet Türleri - Fiyat kategorisine göre (mevcut akış); tükenen kategoriler "Sold out" ile gösterilir */}
              {!isExternalOnlyEvent && bookingMode === "price" && (ticketState.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-600">
                  {t("noTicketsAvailable")}
                </div>
              ) : (
                <div className="mb-8 overflow-hidden rounded-xl border border-slate-200">
                  <div className="hidden bg-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 md:grid md:grid-cols-[minmax(0,1fr)_120px_170px]">
                    <span>{t("ticketType")}</span>
                    <span>{t("price")}</span>
                    <span className="text-right">{t("quantity")}</span>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {ticketState.map((ticketType) => {
                      const availableAmount = Number(ticketType.available || 0);
                      const isSoldOut = availableAmount <= 0;
                      if (isSoldOut) {
                        return (
                          <div
                            key={ticketType.id}
                            className="flex items-center justify-between gap-4 px-5 py-4 bg-slate-50 cursor-default"
                          >
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{ticketType.name}</p>
                              <p className="text-xs text-slate-500">{t("remaining")}: 0</p>
                            </div>
                            <p className="text-lg font-bold text-slate-400">{formatPrice(ticketType.price, event.currency)}</p>
                            <div className="flex items-center justify-end min-w-[100px]">
                              <span className="text-lg font-bold uppercase tracking-wider text-red-600" aria-label={t("soldOut")}>
                                {t("soldOut")}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      const isSelected = selectedTicketType === ticketType.id;
                      const minSelectable = getMinQuantityFromDescription(ticketType.description);
                      const maxSelectable = Math.min(availableAmount, maxTicketsPerOrder);
                      const effectiveMin = Math.min(minSelectable, maxSelectable);
                      const rowCount = isSelected ? ticketCount : 0;

                      return (
                        <div
                          key={ticketType.id}
                          className={`cursor-pointer px-5 py-4 transition-colors ${
                            isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                          }`}
                          onClick={() => {
                            setSelectedTicketType(ticketType.id);
                            setTicketCount((current) => {
                              if (!isSelected) return effectiveMin;
                              return Math.min(Math.max(effectiveMin, current), maxSelectable || effectiveMin);
                            });
                          }}
                        >
                          <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_120px_170px]">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{ticketType.name}</p>
                              <p className="text-xs text-slate-500">
                                {t("remaining")}: {availableAmount}
                                {minSelectable > 1 && (
                                  <span className="ml-1 text-primary-600"> · Min. {minSelectable} adet</span>
                                )}
                              </p>
                            </div>

                            <p className="text-lg font-bold text-primary-700">{formatPrice(ticketType.price, event.currency)}</p>

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTicketType(ticketType.id);
                                  setTicketCount((current) => {
                                    if (!isSelected) return effectiveMin;
                                    return Math.max(effectiveMin, current - 1);
                                  });
                                }}
                                disabled={availableAmount <= 0 || isPastEvent || rowCount <= effectiveMin}
                                className="h-9 w-9 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-sm font-semibold text-slate-900">{rowCount}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTicketType(ticketType.id);
                                  setTicketCount((current) => {
                                    if (!isSelected) return effectiveMin;
                                    return Math.min(maxSelectable || effectiveMin, current + 1);
                                  });
                                }}
                                disabled={availableAmount <= 0 || isPastEvent || rowCount >= maxSelectable}
                                className="h-9 w-9 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Toplam Fiyat ve Sepete Ekle – sadece fiyat kategorisi modunda */}
              {!isExternalOnlyEvent && bookingMode === "price" && <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-lg font-semibold text-slate-900">{t("totalPrice")}</span>
                  <span className="text-3xl font-bold text-primary-700">
                    {formatPrice(totalPrice, event.currency)}
                  </span>
                </div>

                {isPastEvent && (
                  <p className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                    {t("eventEnded")}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedTicket || isPastEvent || isUnapproved) return;
                    const minQ = Math.min(selectedMinQ, selectedMaxQ);
                    if (ticketCount < minQ) return; // Grup biletinde minimum adet şartı
                    addItem({
                      ticketId: selectedTicket.id,
                      eventId: event.id,
                      eventTitle: localized.title || event.title,
                      eventDate: event.date,
                      eventTime: event.time || "20:00",
                      venue: localized.venue || event.venue,
                      location: event.location,
                      imageUrl: event.image_url,
                      ticketName: selectedTicket.name || selectedTicket.ticket_type || "Standart",
                      price: Number(selectedTicket.price || 0),
                      currency: event.currency,
                      eventCheckoutFee:
                        typeof event.checkout_processing_fee === "number" &&
                        event.checkout_processing_fee > 0
                          ? event.checkout_processing_fee
                          : undefined,
                      quantity: ticketCount,
                      available: Number(selectedTicket.available || 0),
                    });
                    setActionMessage(tCheckout("addedToCart"));
                  }}
                  disabled={
                    isUnapproved ||
                    !selectedTicket ||
                    isPastEvent ||
                    ticketCount < Math.min(selectedMinQ, selectedMaxQ)
                  }
                  className="w-full rounded-lg bg-primary-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-primary-700 disabled:bg-slate-300 disabled:text-slate-500"
                >
                  {tCheckout("addToCart")}
                </button>
                {totalItems > 0 && (
                  <Link
                    href={`/${locale}/sepet`}
                    className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
                  >
                    {tCheckout("goToCheckout")} ({totalItems})
                  </Link>
                )}
              </div>}
            </div>

            {/* Etkinlik Detayları */}
            <div className="bg-white rounded-xl border border-slate-200 p-8 mt-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">{t("aboutEvent")}</h2>
              <div className="prose prose-slate max-w-none">
                <p className="text-slate-700 leading-relaxed">
                  {parsedDescription.content || t("aboutPlaceholder")}
                </p>
              </div>
            </div>

            {/* Bilet hatırlatıcısı + Güvenli alışveriş – mekan bilgisinin hemen üstünde, yan yana */}
            <div className="grid sm:grid-cols-2 gap-4 mt-8">
              {!isPastEvent && (
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <Bell className="h-5 w-5 text-amber-600" />
                    {t("ticketReminder")}
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">{t("reminderDesc")}</p>
                  <form onSubmit={handleReminderSubmit} className="space-y-3">
                    <input
                      type="email"
                      value={reminderEmail}
                      onChange={(e) => setReminderEmail(e.target.value)}
                      placeholder={t("reminderPlaceholder")}
                      required
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      type="submit"
                      disabled={reminderPending}
                      className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {reminderPending ? t("saving") : t("getReminder")}
                    </button>
                  </form>
                  {reminderResult && (
                    <p className={`mt-3 text-sm ${reminderResult.success ? "text-green-700" : "text-red-700"}`}>
                      {reminderResult.message}
                    </p>
                  )}
                </div>
              )}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">{t("secureShopping")}</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm text-slate-700">{t("originalTicket")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm text-slate-700">{t("securePayment")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-sm text-slate-700">{t("instantDelivery")}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mekan Bilgisi - SSS, Ulaşım, Giriş */}
            {venue && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 mt-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">{t("venueInfo")}</h2>
                  <Link
                    href={`/${locale}/mekanlar`}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    {t("allVenues")} →
                  </Link>
                </div>
                <div className="space-y-6">
                  {(venue.image_url_1 || venue.image_url_2) && (
                    <div className="flex gap-2">
                      {venue.image_url_1 && (
                        <img
                          src={venue.image_url_1}
                          alt={`${venue.name} - Fotoğraf 1`}
                          className="rounded-lg border border-slate-200 object-cover h-32 w-full max-w-[200px]"
                        />
                      )}
                      {venue.image_url_2 && (
                        <img
                          src={venue.image_url_2}
                          alt={`${venue.name} - Fotoğraf 2`}
                          className="rounded-lg border border-slate-200 object-cover h-32 w-full max-w-[200px]"
                        />
                      )}
                    </div>
                  )}
                  {venue.seating_layout_description && (
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-2">{t("seatingPlan")}</h3>
                      <p className="text-slate-600">{venue.seating_layout_description}</p>
                      {venue.seating_layout_image_url && (
                        <>
                        <img
                          src={venue.seating_layout_image_url}
                          alt={`${venue.name} oturma planı`}
                          className="mt-3 rounded-lg border border-slate-200 max-w-md"
                        />
                        {hasSeatingPlan && (
                          <p className="mt-2 text-xs text-slate-500">
                            Bu görsel mekân tanıtımı içindir. Gerçek koltuk seçimi sayfanın üstündeki &quot;Yer seçerek bilet al&quot; bölümündedir.
                          </p>
                        )}
                        </>
                      )}
                    </div>
                  )}
                  {venue.transport_info && (
                    <div className="flex items-start gap-3">
                      <Car className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 mb-1">{t("transport")}</h3>
                        <div
                          className="text-slate-600 prose prose-sm max-w-none [&_p]:my-1 [&_ul]:my-2"
                          dangerouslySetInnerHTML={{ __html: venue.transport_info }}
                        />
                      </div>
                    </div>
                  )}
                  {(() => {
                    const mapUrl = extractMapEmbedUrl(venue.map_embed_url);
                    return mapUrl ? (
                      <div>
                        <h3 className="font-semibold text-slate-800 mb-2">{t("map")}</h3>
                        <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200">
                          <iframe
                            src={mapUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title={`${venue.name} harita`}
                            className="h-full w-full"
                          />
                        </div>
                      </div>
                    ) : null;
                  })()}
                  {venue.entrance_info && (
                    <div className="flex items-start gap-3">
                      <DoorOpen className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-slate-800 mb-1">{t("entranceInfo")}</h3>
                        <p className="text-slate-600">{venue.entrance_info}</p>
                      </div>
                    </div>
                  )}
                  {venue.rules && (
                    <div>
                      <h3 className="font-semibold text-slate-800 mb-1">{t("entranceRules")}</h3>
                      <p className="text-slate-600">{venue.rules}</p>
                    </div>
                  )}
                  {venue.faq.length > 0 && (
                    <div>
                      <button
                        onClick={() => setVenueFaqOpen((o) => !o)}
                        className="flex items-center gap-2 text-slate-800 font-semibold hover:text-primary-600"
                      >
                        <HelpCircle className="h-5 w-5" />
                        {t("faq")}
                        {venueFaqOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      {venueFaqOpen && (
                        <div className="mt-4 space-y-4 border-l-2 border-primary-200 pl-4">
                          {venue.faq.map((item, i) => (
                            <div key={i}>
                              <p className="font-medium text-slate-800">{item.soru}</p>
                              <p className="mt-1 text-slate-600">{item.cevap}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
