"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import NextLink from "next/link";
import {
  Calendar,
  MapPin,
  Clock,
  Ticket,
  Share2,
  Heart,
  ChevronRight,
  ChevronLeft,
  Star,
  Users,
  Car,
  DoorOpen,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Bell,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import Header from "@/components/Header";
import type { Event, Ticket as EventTicket, Venue } from "@/types/database";
import { parseEventDescription } from "@/lib/eventMeta";
import { formatEventVenueAddressCityLine } from "@/lib/event-venue-display";
import { formatPrice } from "@/lib/formatPrice";
import { getLocalizedEvent, type Locale } from "@/lib/i18n-content";
import { extractMapEmbedUrl } from "@/lib/mapEmbed";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase-client";
import { fetchAllSeatsByRowIds } from "@/lib/fetch-all-seats-by-row-ids";
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
import { getTicketCategoryColorHex, lightenHex } from "@/lib/seating-plans/ticket-category-colors";

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
  locale?: Locale;
  /** Etkinlik henüz onaylanmadı (organizatör önizlemesi); bilet satışı kapalı */
  isUnapproved?: boolean;
}

/** Oturum planı: bölüm > sıra > koltuk (koltuk seçimi UI için); bölümde ticket_type_label etkinlikteki bilet adıyla eşlenir */
type SeatPlanSeat = { id: string; seat_label: string; sales_blocked?: boolean | null };
type SeatPlanRow = { id: string; row_label: string; ticket_type_label?: string | null; seats: SeatPlanSeat[] };
type SeatPlanSection = {
  id: string;
  name: string;
  ticket_type_label?: string | null;
  section_align?: "left" | "center" | "right" | null;
  rows: SeatPlanRow[];
};

type TicketLike = { id: string; name?: string | null; price?: number | null; available?: number | null };
const MUSENSAAL_PREFIXES = ["P", "EML", "EMR", "SEL", "SER", "EH"] as const;

/**
 * Bilet türü adında peş peşe aynı kelime grubunun tekrar etmesini kaldırır.
 * Örn. "Orta salon - VIP VIP" → "Orta salon - VIP"
 *      "Orta salon - Kategori 1 Kategori 1" → "Orta salon - Kategori 1"
 *      "VIP" → "VIP" (değişmez)
 */
function dedupeRepeatedTail(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return name.trim();
  for (let k = 1; k <= Math.floor(tokens.length / 2); k++) {
    const tail = tokens.slice(-k).join(" ").toLowerCase();
    const before = tokens.slice(-2 * k, -k).join(" ").toLowerCase();
    if (tail && before && tail === before) {
      return tokens.slice(0, -k).join(" ").trim();
    }
  }
  return name.trim();
}

/** Görünen kısa kategori adı: "Orta salon - VIP VIP" → "VIP"; bilinmeyen format için temizlenmiş tam ad. */
function shortenTicketDisplayName(name: string): string {
  const cleaned = dedupeRepeatedTail(name);
  const dashIdx = cleaned.lastIndexOf(" - ");
  if (dashIdx > 0) {
    const tail = cleaned.slice(dashIdx + 3).trim();
    if (tail) return tail;
  }
  return cleaned;
}

/**
 * Bilet listesi sıralama anahtarı: VIP en başta, ardından Kategori 1, 2, 3, … sayısal sırayla.
 * Bilinmeyen kategoriler en sona düşer.
 */
function ticketCategorySortKey(name: string): number {
  const short = shortenTicketDisplayName(name).toLowerCase().trim();
  if (!short) return 9999;
  if (/^vip\b/.test(short) || short === "vip") return 0;
  const m = short.match(/kategori\s*(\d+)/);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 9999;
}

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
  const norm = (s: string) => s.trim().toLowerCase();
  const lowLabel = norm(label);
  const lowSection = norm(sectionName);

  // 1) Birebir ticket adı = ticket_type_label
  const byLabel = lowLabel
    ? availableTickets.find((t) => norm(t.name || "") === lowLabel)
    : null;
  if (byLabel) return { ticket: byLabel, matchedBy: "name" };

  // 2) Birebir ticket adı = section.name (örn. "Orta salon - VIP")
  const bySectionName = lowSection
    ? availableTickets.find((t) => norm(t.name || "") === lowSection)
    : null;
  if (bySectionName) return { ticket: bySectionName, matchedBy: "name" };

  // 3) ticket adı, ticket_type_label ile bitsin (örn. ticket="Orta salon - VIP", label="VIP")
  //    Bu sayede tekrar etmiş adlardan ("Orta salon - VIP VIP") veya kullanıcı tarafından
  //    serbest düzenlenmiş adlardan da doğru eşleşme yakalanır.
  if (lowLabel) {
    const bySuffix = availableTickets.find((t) => {
      const n = norm(t.name || "");
      if (!n) return false;
      return (
        n === lowLabel ||
        n.endsWith(" - " + lowLabel) ||
        n.endsWith(" " + lowLabel) ||
        n.endsWith("-" + lowLabel)
      );
    });
    if (bySuffix) return { ticket: bySuffix, matchedBy: "name" };
  }

  // 4) Son çare: sıra (index) eşlemesi.
  const byIndex = availableTickets[sectionIndex];
  return { ticket: byIndex ?? availableTickets[0], matchedBy: "index" };
}

function getTicketForRow(
  section: SeatPlanSection,
  row: SeatPlanRow | undefined,
  sectionIndex: number,
  availableTickets: TicketLike[]
): { ticket: TicketLike; matchedBy: "name" | "index" } {
  const rowL = (row?.ticket_type_label || "").trim();
  const sectionName = (section.name ?? "").trim();
  const norm = (s: string) => s.trim().toLowerCase();

  if (rowL) {
    const byRow = availableTickets.find((t) => norm(t.name || "") === norm(rowL));
    if (byRow) return { ticket: byRow, matchedBy: "name" };
    const rl = norm(rowL);
    // Ad sonu eşleşmesi: ticket="Orta salon - VIP" / rowL="VIP" gibi durumlar.
    const byRowSuffix = availableTickets.find((t) => {
      const n = norm(t.name || "");
      if (!n) return false;
      return (
        n === rl ||
        n.endsWith(" - " + rl) ||
        n.endsWith(" " + rl) ||
        n.endsWith("-" + rl)
      );
    });
    if (byRowSuffix) return { ticket: byRowSuffix, matchedBy: "name" };
    if (sectionName) {
      const composite = `${sectionName} ${rowL}`.trim();
      const byComposite = availableTickets.find((t) => norm(t.name || "") === norm(composite));
      if (byComposite) return { ticket: byComposite, matchedBy: "name" };
      const sn = norm(sectionName);
      const bySectionPlus = availableTickets.find((t) => {
        const n = norm(t.name || "");
        return n === `${sn} ${rl}` || (n.startsWith(`${sn} `) && (n.endsWith(` ${rl}`) || n.endsWith(rl)));
      });
      if (bySectionPlus) return { ticket: bySectionPlus, matchedBy: "name" };
    }
  }
  return getTicketForSection(section, sectionIndex, availableTickets);
}

/** Sepette veya anlık seçimde: plan üzerinde fosforlu yeşil (satılmadıkça). */
const HELD_SEAT_FLUO = "#39ff14";

/** EventSeat şematik salon planı: bölümleri yan yana, sahne altta, koltuklar tıklanabilir. Satılmış koltuklar dolu gösterilir, tıklanamaz. */
function SeatMapSvg({
  sections,
  heldSeatIds,
  soldSeatIds,
  onSeatToggle,
  seatCategoryHexBySeatId,
  selectableSeatIds,
  salesBlockedSeatIds,
  seatTitleById,
  stageLabel,
  seatLabelWord,
}: {
  sections: SeatPlanSection[];
  /** Seçili + bu etkinlik için sepetteki koltuklar (satın alınana kadar fosforlu yeşil). */
  heldSeatIds: Set<string>;
  soldSeatIds: Set<string>;
  onSeatToggle: (seatId: string) => void;
  seatCategoryHexBySeatId: Map<string, string>;
  selectableSeatIds?: Set<string>;
  salesBlockedSeatIds?: Set<string>;
  seatTitleById?: Map<string, string>;
  stageLabel: string;
  seatLabelWord: string;
}) {
  const [hoveredSeatId, setHoveredSeatId] = useState<string | null>(null);
  const pad = 12;
  const stageH = 32;
  const mapW = 720;
  const stageGap = 8;
  const sectionGap = 8;
  const corridorGap = 36;
  const nSections = sections.length;
  if (nSections === 0) return null;
  const sectionGroup = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("sol") || n.includes("left")) return 0;
    if (n.includes("sağ") || n.includes("sag") || n.includes("right")) return 2;
    return 1;
  };
  const sectionAlignment = (name: string): "left" | "center" | "right" => {
    const n = name.toLowerCase();
    if (n.includes("sola hizala") || n.includes("left align")) return "left";
    if (n.includes("saga hizala") || n.includes("sağa hizala") || n.includes("right align")) return "right";
    if (n.includes("ortala") || n.includes("center align")) return "center";
    const g = sectionGroup(name);
    if (g === 0) return "left";
    if (g === 2) return "right";
    return "center";
  };
  const sectionDepth = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("ön") || n.includes("on") || n.includes("front")) return 0;
    if (n.includes("orta") || n.includes("middle")) return 1;
    if (n.includes("arka") || n.includes("back")) return 2;
    return 0;
  };
  /**
   * Bölüm sıralaması:
   * 1) Sol / Orta / Sağ koridor grubu (her zaman koridor ilk belirleyici).
   * 2) Aynı blok içinde en küçük sıra numarası (örn. VIP=S1-3 → sahneye en yakın → en üstte).
   * 3) Tie-break: DB sort_order (sections dizisindeki sıra).
   */
  const sectionOriginalIndex = new Map(sections.map((s, idx) => [s.id, idx] as const));
  const sectionMinRowNum = (s: SeatPlanSection): number => {
    let min = Number.POSITIVE_INFINITY;
    for (const r of s.rows) {
      const n = Number.parseInt(String(r.row_label || "").trim(), 10);
      if (Number.isFinite(n) && n < min) min = n;
    }
    return Number.isFinite(min) ? min : Number.MAX_SAFE_INTEGER;
  };
  const displaySections = [...sections].sort((a, b) => {
    const ga = sectionGroup(String(a.name || ""));
    const gb = sectionGroup(String(b.name || ""));
    if (ga !== gb) return ga - gb;
    const da = sectionDepth(String(a.name || ""));
    const db = sectionDepth(String(b.name || ""));
    if (da !== db) return da - db;
    const ra = sectionMinRowNum(a);
    const rb = sectionMinRowNum(b);
    if (ra !== rb) return ra - rb;
    return (sectionOriginalIndex.get(a.id) ?? 0) - (sectionOriginalIndex.get(b.id) ?? 0);
  });
  const sectionMaxRows = Math.max(...displaySections.map((s) => s.rows.length), 1);
  const sectionMaxSeats = Math.max(
    ...displaySections.flatMap((s) => s.rows.map((r) => r.seats.length)),
    1
  );
  const leftSections = displaySections.filter((s) => sectionGroup(String(s.name || "")) === 0);
  const centerSections = displaySections.filter((s) => sectionGroup(String(s.name || "")) === 1);
  const rightSections = displaySections.filter((s) => sectionGroup(String(s.name || "")) === 2);

  const usableW = mapW - pad * 2;
  const baseY = pad + stageH + stageGap;
  /** Aynı bloka ait bölümlerin (örn. "Orta salon - VIP", "Orta salon - Kategori 1") üstündeki tek başlık. */
  const groupHeaderH = 24;
  const sectionBottomPad = 8;
  /** Aynı grup içinde bölümler arası boşluk: 0 (tek parça blok görünümü). */
  const sectionInGroupGap = 0;
  /** Farklı bloklar (gruplar) arası boşluk. */
  const groupStackGap = 18;

  const hasSideTop = leftSections.length > 0 || rightSections.length > 0;
  const hasLeftRightPair = leftSections.length > 0 && rightSections.length > 0;
  const topLaneGap = hasLeftRightPair ? corridorGap : sectionGap;
  const topLaneW = hasLeftRightPair ? (usableW - topLaneGap) / 2 : usableW;
  const topLeftX = pad + (hasLeftRightPair ? 0 : (usableW - topLaneW) / 2);
  const topRightX = hasLeftRightPair ? topLeftX + topLaneW + topLaneGap : topLeftX;

  /**
   * Bölümleri blok adı prefix'ine göre grupla:
   * "Orta salon - VIP", "Orta salon - Kategori 1", … hepsi aynı "Orta salon" bloğunun parçaları olduğu için
   * tek bir görsel kart içinde alt alta yığılır (bölüm başına ayırıcı çizgi / boşluk yok; yalnızca kategori
   * renkleri farklılaşır). Birden fazla blok grubu varsa gruplar yan yana yerleştirilir.
   */
  const getBlockPrefix = (name: string): string => {
    const dashIdx = name.indexOf(" - ");
    return dashIdx > 0 ? name.slice(0, dashIdx).trim() : name.trim();
  };
  const groupSections = (list: SeatPlanSection[]): SeatPlanSection[][] => {
    const groups: SeatPlanSection[][] = [];
    const idx = new Map<string, number>();
    for (const s of list) {
      const key = getBlockPrefix(String(s.name || ""));
      let gi = idx.get(key);
      if (gi === undefined) {
        gi = groups.length;
        idx.set(key, gi);
        groups.push([]);
      }
      groups[gi].push(s);
    }
    return groups;
  };
  const leftGroups = groupSections(leftSections);
  const rightGroups = groupSections(rightSections);
  const centerGroups = groupSections(centerSections);
  const centerGroupCount = centerGroups.length;
  /** Tek blok grubu → full width; birden fazla grup → 2 sütun (3+ grup için satır geçişi). */
  const centerSlotW =
    centerGroupCount <= 1
      ? Math.min(usableW, Math.max(220, usableW - 16))
      : Math.max(200, Math.min(340, (usableW - sectionGap) / 2));

  /** Koltuk ölçeği: en dar yerleşim kutusuna göre (üst şerit veya orta ızgarada dar sütun). */
  const sectionWForSeats = hasSideTop
    ? Math.min(Math.max(220, topLaneW - 8), centerSections.length ? centerSlotW : Math.max(220, topLaneW - 8))
    : centerSlotW;

  const seatSize = Math.min((sectionWForSeats - 26) / sectionMaxSeats, 18, 22);
  const rowH = Math.max(22, Math.min(30, seatSize * 1.45));
  /** Dar çerçeve: koltuk merkezleri birbirine yakın (eski 2.4 çarpanı fazla boşluk bırakıyordu). */
  const seatW = Math.min((sectionWForSeats - 26) / sectionMaxSeats, seatSize * 1.28);
  /** Bir bölümün yalnızca koltuk gövdesi (header yok; başlık grup seviyesinde tek). */
  const getSectionBodyH = (s: SeatPlanSection) => Math.max(1, s.rows.length) * rowH + sectionBottomPad;

  type SectionLayoutInfo = {
    sx: number;
    sy: number;
    sectionH: number;
    width: number;
    groupKey: string;
  };
  type GroupLayoutInfo = {
    sx: number;
    sy: number;
    w: number;
    h: number;
    label: string;
    sectionIds: string[];
  };
  const sectionLayout = new Map<string, SectionLayoutInfo>();
  const groupLayout = new Map<string, GroupLayoutInfo>();
  let contentBottom = baseY;

  /** Bir blok grubunu (aynı blok prefix'ine sahip bölümler) tek kart şeklinde yığar; bölümler arası ayırıcı yoktur. */
  const placeGroups = (
    groups: SeatPlanSection[][],
    sx: number,
    blockW: number,
    keyPrefix: string,
    yStart: number = baseY,
  ): number => {
    let y = yStart;
    let lastBottom = yStart;
    groups.forEach((grp, gi) => {
      if (!grp.length) return;
      const groupKey = `${keyPrefix}-${gi}`;
      const groupTop = y;
      let yy = groupTop + groupHeaderH;
      const ids: string[] = [];
      grp.forEach((s) => {
        const bodyH = getSectionBodyH(s);
        sectionLayout.set(s.id, { sx, sy: yy, sectionH: bodyH, width: blockW, groupKey });
        ids.push(s.id);
        yy += bodyH + sectionInGroupGap;
      });
      const groupBottom = yy - sectionInGroupGap;
      groupLayout.set(groupKey, {
        sx,
        sy: groupTop,
        w: blockW,
        h: groupBottom - groupTop,
        label: getBlockPrefix(String(grp[0].name || "")),
        sectionIds: ids,
      });
      lastBottom = groupBottom;
      contentBottom = Math.max(contentBottom, groupBottom);
      y = groupBottom + groupStackGap;
    });
    return lastBottom;
  };

  if (hasSideTop) {
    if (leftGroups.length) placeGroups(leftGroups, topLeftX, topLaneW, "left");
    if (rightGroups.length) placeGroups(rightGroups, topRightX, topLaneW, "right");
  }

  let yCenterBand = baseY;
  if (hasSideTop) {
    let maxTop = baseY;
    for (const [, g] of groupLayout) {
      maxTop = Math.max(maxTop, g.sy + g.h);
    }
    yCenterBand = maxTop + groupStackGap;
  }

  if (centerGroups.length) {
    let i = 0;
    let y = yCenterBand;
    while (i < centerGroups.length) {
      const remaining = centerGroups.length - i;
      const inRow = remaining === 1 ? 1 : 2;
      const rowGroups = centerGroups.slice(i, i + inRow);
      const rowWidth = rowGroups.length * centerSlotW + (rowGroups.length - 1) * sectionGap;
      const startX = pad + Math.max(0, (usableW - rowWidth) / 2);
      let rowBottom = y;
      rowGroups.forEach((grp, c) => {
        const sx = startX + c * (centerSlotW + sectionGap);
        const colBottom = placeGroups([grp], sx, centerSlotW, `center-${i}-${c}`, y);
        rowBottom = Math.max(rowBottom, colBottom);
      });
      contentBottom = Math.max(contentBottom, rowBottom);
      y = rowBottom + groupStackGap;
      i += inRow;
    }
  }

  const mapH = Math.max(300, contentBottom - baseY + sectionBottomPad);

  const stageTarget = sectionMaxSeats * seatW * 1.05;
  const stageWRaw = Math.max(mapW * 0.24, Math.min(mapW * 0.38, stageTarget));
  const stageW = Math.min(
    stageWRaw,
    hasLeftRightPair ? (topLaneW * 2 + topLaneGap) * 0.92 : Math.max(centerSlotW, topLaneW) * 0.92
  );
  const stageX = pad + (mapW - stageW) / 2;

  return (
    <svg
      viewBox={`0 0 ${mapW + pad * 2} ${mapH + stageH + stageGap + pad * 2}`}
      className="w-full max-w-full rounded-lg border border-slate-200 bg-white block h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Blok kartları: aynı bloka ait tüm kategori bölümleri tek rect + tek başlık olarak gösterilir. */}
      {Array.from(groupLayout.entries()).map(([groupKey, g]) => (
        <g key={`group-${groupKey}`}>
          <rect
            x={g.sx}
            y={g.sy}
            width={g.w}
            height={g.h}
            rx={6}
            fill="#ffffff"
            stroke="#94a3b8"
            strokeWidth={1}
          />
          <text
            x={g.sx + g.w / 2}
            y={g.sy + 16}
            textAnchor="middle"
            fill="#334155"
            fontSize={11}
            fontWeight={600}
          >
            {g.label}
          </text>
        </g>
      ))}
      {/* Bölümlerin sıraları (rect/başlık yok; sadece sıralar ve koltuklar). */}
      {displaySections.map((section) => {
        const layout = sectionLayout.get(section.id);
        if (!layout) return null;
        const sx = layout.sx;
        const sy = layout.sy;
        const blockW = layout.width;
        return (
          <g key={section.id}>
            {section.rows.map((row, ri) => {
              const rowY = sy + ri * rowH + rowH / 2;
              const rowSeatCount = Math.max(row.seats.length, 1);
              const rowSeatAreaW = Math.max(0, rowSeatCount * seatW);
              const usableLeft = sx + 10;
              const usableRight = sx + blockW - 10;
              const usableW = Math.max(0, usableRight - usableLeft);
              const persistAlign = section.section_align;
              const align =
                persistAlign === "left" || persistAlign === "center" || persistAlign === "right"
                  ? persistAlign
                  : sectionAlignment(String(section.name || ""));
              let rowStartX = usableLeft;
              if (align === "center") {
                rowStartX = usableLeft + Math.max(0, (usableW - rowSeatAreaW) / 2);
              } else if (align === "right") {
                rowStartX = usableRight - rowSeatAreaW;
              }
              const group = sectionGroup(String(section.name || ""));
              const rowLabelGap = Math.max(6, Math.min(12, seatW * 0.6));
              const rowLabelX = group === 2
                ? Math.min(sx + blockW - 6, rowStartX + rowSeatAreaW + rowLabelGap)
                : Math.max(sx + 6, rowStartX - rowLabelGap);
              const rowLabelAnchor = group === 2 ? "end" : "start";
              return (
                <g key={`row-${section.id}-${row.id}`}>
                  <text
                    x={rowLabelX}
                    y={rowY + 3}
                    textAnchor={rowLabelAnchor}
                    fill="#64748b"
                    fontSize={9}
                    fontWeight={600}
                  >
                    {row.row_label}
                  </text>
                  {row.seats.map((seat, ci) => {
                const cx = rowStartX + ci * seatW + seatW / 2;
                const cy = rowY;
                const isHeld = heldSeatIds.has(seat.id);
                const isSold = soldSeatIds.has(seat.id);
                const isSalesBlocked = salesBlockedSeatIds?.has(seat.id) ?? false;
                const isSelectable = selectableSeatIds ? selectableSeatIds.has(seat.id) : true;
                const isUnavailable = isSold || isSalesBlocked || !isSelectable;
                const isHovered = hoveredSeatId === seat.id;
                const catHex = seatCategoryHexBySeatId.get(seat.id) ?? "#64748b";
                let fill: string;
                let stroke: string;
                let sw = 0;
                if (isSold) {
                  fill = "#d1d5db";
                  stroke = "#d1d5db";
                } else if (isSalesBlocked) {
                  fill = "#fde68a";
                  stroke = "#b45309";
                  sw = 1.5;
                } else if (isUnavailable) {
                  fill = "#cbd5e1";
                  stroke = "#94a3b8";
                  sw = 1.5;
                } else if (isHeld) {
                  fill = HELD_SEAT_FLUO;
                  stroke = HELD_SEAT_FLUO;
                } else if (isHovered) {
                  fill = HELD_SEAT_FLUO;
                  stroke = HELD_SEAT_FLUO;
                } else {
                  fill = catHex;
                  stroke = catHex;
                  sw = 0;
                }
                return (
                  <g
                    key={seat.id}
                    style={{ cursor: isUnavailable ? "not-allowed" : "pointer" }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={seatSize / 2}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={sw}
                      onMouseDown={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => !isUnavailable && onSeatToggle(seat.id)}
                      onMouseEnter={() => !isUnavailable && setHoveredSeatId(seat.id)}
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

/** EventSeat: salon planını büyük alan içinde zoom/pan ile kullanılabilir yapar. Satılmış koltuklar dolu gösterilir. */
function SeatMapWithZoom({
  sections,
  heldSeatIds,
  soldSeatIds,
  onSeatToggle,
  seatCategoryHexBySeatId,
  selectableSeatIds,
  salesBlockedSeatIds,
  seatTitleById,
  stageLabel,
  seatLabelWord,
  availableTickets,
  selectedSeatCategory,
  onSelectSeatCategory,
  locale,
  currency,
}: {
  sections: SeatPlanSection[];
  heldSeatIds: Set<string>;
  soldSeatIds: Set<string>;
  onSeatToggle: (seatId: string) => void;
  seatCategoryHexBySeatId: Map<string, string>;
  selectableSeatIds?: Set<string>;
  salesBlockedSeatIds?: Set<string>;
  seatTitleById?: Map<string, string>;
  stageLabel: string;
  seatLabelWord: string;
  availableTickets: TicketLike[];
  selectedSeatCategory: string;
  onSelectSeatCategory: (value: string) => void;
  locale: Locale;
  currency: Event["currency"];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
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
    setScale(1);
    setPan({ x: 0, y: 0 });
  };
  const maxRowsInSection = Math.max(...sections.map((s) => s.rows.length), 1);
  const dynamicFrameMinHeight = Math.round(
    Math.min(820, Math.max(340, 180 + maxRowsInSection * 24 + Math.ceil(sections.length / 2) * 64))
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="relative">
          <button
            type="button"
            onClick={() => setCategoryOpen((o) => !o)}
            className="inline-flex w-[320px] max-w-[86vw] items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span className="truncate text-left">
              {selectedSeatCategory === "all"
                ? locale === "de"
                  ? "Alle Kategorien"
                  : locale === "en"
                  ? "All categories"
                  : "Tüm kategoriler"
                : shortenTicketDisplayName(selectedSeatCategory)}
            </span>
            {categoryOpen ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
            )}
          </button>
          {categoryOpen && (
            <div className="absolute left-0 top-full z-20 mt-1 w-[320px] max-w-[86vw] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  onSelectSeatCategory("all");
                  setCategoryOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm ${
                  selectedSeatCategory === "all" ? "bg-primary-50" : "hover:bg-slate-50"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-[3px] bg-[#ef4444]" />
                  <span className="h-3 w-3 rounded-[3px] bg-[#3b82f6]" />
                  <span className="h-3 w-3 rounded-[3px] bg-[#10b981]" />
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {locale === "de" ? "Alle Kategorien" : locale === "en" ? "All categories" : "Tüm kategoriler"}
                </span>
              </button>
              {[...availableTickets]
                .sort((a, b) => {
                  const ka = ticketCategorySortKey(a.name || "");
                  const kb = ticketCategorySortKey(b.name || "");
                  if (ka !== kb) return ka - kb;
                  /** Bilinmeyen kategoriler için fiyatı yüksekten düşüğe yedek sıralama. */
                  return Number(b.price || 0) - Number(a.price || 0);
                })
                .map((tk) => {
                const name = (tk.name || "Bilet").trim();
                const display = shortenTicketDisplayName(name);
                const active = selectedSeatCategory === name;
                return (
                  <button
                    key={tk.id}
                    type="button"
                    onClick={() => {
                      onSelectSeatCategory(name);
                      setCategoryOpen(false);
                    }}
                      className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm ${
                      active ? "bg-primary-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-[4px] shrink-0"
                      style={{ backgroundColor: getTicketCategoryColorHex(display) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-800">{display}</span>
                    <span className="shrink-0 font-semibold text-slate-700">
                      {formatPrice(Number(tk.price || 0), currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={zoomIn}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          aria-label="Yakınlaştır"
          title="Yakınlaştır"
        >
          <ZoomIn className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          aria-label="Uzaklaştır"
          title="Uzaklaştır"
        >
          <ZoomOut className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Ortala
        </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-slate-200 bg-white touch-none"
        style={{
          minHeight: dynamicFrameMinHeight,
          maxHeight: "min(82vh, 860px)",
          cursor: isDragging ? "grabbing" : "grab",
        }}
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
            minHeight: dynamicFrameMinHeight,
            display: "flex",
            justifyContent: "center",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <SeatMapSvg
            sections={sections}
            heldSeatIds={heldSeatIds}
            soldSeatIds={soldSeatIds}
            onSeatToggle={handleSeatClick}
            seatCategoryHexBySeatId={seatCategoryHexBySeatId}
            selectableSeatIds={selectableSeatIds}
            salesBlockedSeatIds={salesBlockedSeatIds}
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
  const locale = ((useLocale() as Locale) || localeProp) as Locale;
  const searchParams = useSearchParams();
  const showSeatGridDebug = searchParams.get("seatDebug") === "1";
  const { addItem, removeSeatItem, totalItems, items: cartItems } = useCart();

  const [ticketState, setTicketState] = useState<EventTicket[]>(tickets);
  /** Stoklu biletler (satın alma UI’si bunu kullanmalı; tükenmiş satırlar ayrı kategori gibi görünmesin). */
  const availableTickets = useMemo(
    () => ticketState.filter((ticket) => Number(ticket.available || 0) > 0),
    [ticketState]
  );
  const hasSeatingPlan = !!(event as Event & { seating_plan_id?: string }).seating_plan_id;
  const localized = useMemo(() => getLocalizedEvent(event as unknown as Record<string, unknown>, locale), [event, locale]);
  const parsedDescription = useMemo(() => parseEventDescription(localized.description || event.description), [localized.description, event.description]);
  const externalTicketUrl = useMemo(() => {
    const fromLocalized = parsedDescription.externalTicketUrl;
    if (fromLocalized) return fromLocalized;
    const ev = event as Event & { description_tr?: string | null };
    const fromTr = parseEventDescription(ev.description_tr || event.description || "").externalTicketUrl;
    if (fromTr) return fromTr;
    return (event as Event & { ticket_url?: string }).ticket_url || "";
  }, [parsedDescription.externalTicketUrl, event]);
  const whereLine = useMemo(
    () => formatEventVenueAddressCityLine(event, localized.venue || event.venue || ""),
    [event, localized.venue]
  );
  const isExternalOnlyEvent = Boolean(externalTicketUrl) && availableTickets.length === 0;
  const [selectedTicketType, setSelectedTicketType] = useState<string>(
    availableTickets[0]?.id || ""
  );
  const [ticketCount, setTicketCount] = useState<number>(1);
  /** Kullanıcı hangi akıştan ilerleyeceğine kendisi karar verir (başlangıçta ikisi de kapalı). */
  const [bookingMode, setBookingMode] = useState<"price" | "seat" | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  /** Koltuk seçimi: yüklü plan yapısı (bölüm > sıra > koltuk) */
  const [seatingPlanData, setSeatingPlanData] = useState<SeatPlanSection[] | null>(null);
  const [seatingPlanName, setSeatingPlanName] = useState("");
  const [seatingPlanLoading, setSeatingPlanLoading] = useState(false);
  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set());

  const cartSeatIdsForEvent = useMemo(() => {
    const s = new Set<string>();
    for (const it of cartItems) {
      if (it.eventId !== event.id) continue;
      for (const id of it.seatIds || []) s.add(id);
    }
    return s;
  }, [cartItems, event.id]);

  /** Plan rengi: anlık seçim + sepet (satın alınana kadar fosforlu yeşil). */
  const heldSeatIds = useMemo(() => {
    const u = new Set<string>();
    selectedSeatIds.forEach((id) => u.add(id));
    cartSeatIdsForEvent.forEach((id) => u.add(id));
    return u;
  }, [selectedSeatIds, cartSeatIdsForEvent]);

  /** Satılmış koltuklar (completed siparişlerdeki order_seats) – salon planında dolu gösterilir, seçilemez */
  const [soldSeatIds, setSoldSeatIds] = useState<Set<string>>(new Set());
  /** Başka kullanıcı tarafından geçici olarak tutulan koltuklar */
  const [heldByOthersSeatIds, setHeldByOthersSeatIds] = useState<Set<string>>(new Set());
  /** EventSeat: "list" = liste görünümü, "map" = salon planı (şematik) */
  const [seatMapView, setSeatMapView] = useState<"list" | "map">("map");
  const [selectedSeatCategory, setSelectedSeatCategory] = useState<string>("all");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const seatActionPendingIdsRef = useRef<Set<string>>(new Set());
  /** Yer seçerek bilet al akışında, seçilen koltuklar sepete eklendi mi? (sidebar mesajını değiştirmek için) */
  const [hasSeatSelectionAddedToCart, setHasSeatSelectionAddedToCart] = useState(false);
  /** Koltuk geçici rezervasyonları için anonim oturum kimliği */
  const [seatHoldSessionId, setSeatHoldSessionId] = useState<string | null>(null);
  const [venueFaqOpen, setVenueFaqOpen] = useState(false);
  /** Mekan foto galerisi lightbox (0..n-1) */
  const [venueGalleryIndex, setVenueGalleryIndex] = useState<number | null>(null);
  const [reminderEmail, setReminderEmail] = useState("");
  const [reminderPending, setReminderPending] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ success: boolean; message: string } | null>(null);
  /** Site ayarı: sipariş başına max bilet (varsayılan 10) */
  const [maxTicketsPerOrder, setMaxTicketsPerOrder] = useState(10);
  const stageLabel = locale === "de" ? "Bühne" : locale === "en" ? "Stage" : "Sahne";
  const rowLabelWord = locale === "de" ? "Reihe" : locale === "en" ? "Row" : "Sıra";
  const seatLabelWord = locale === "de" ? "Platz" : locale === "en" ? "Seat" : "Koltuk";
  const venuePhotoUrls = useMemo(() => {
    if (!venue) return [];
    return [venue.image_url_1, venue.image_url_2, venue.image_url_3, venue.image_url_4, venue.image_url_5]
      .map((u) => String(u ?? "").trim())
      .filter((u) => u.length > 0);
  }, [venue]);

  useEffect(() => {
    if (venueGalleryIndex === null || venuePhotoUrls.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setVenueGalleryIndex(null);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setVenueGalleryIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setVenueGalleryIndex((i) =>
          i !== null && i < venuePhotoUrls.length - 1 ? i + 1 : i
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [venueGalleryIndex, venuePhotoUrls.length]);

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
  const cartItemForSelectedPriceTicket = useMemo(() => {
    if (!selectedTicket) return null;
    return (
      cartItems.find((it) => it.eventId === event.id && it.ticketId === selectedTicket.id) || null
    );
  }, [cartItems, event.id, selectedTicket]);
  const currentEventCartCount = useMemo(() => {
    return cartItems
      .filter((it) => it.eventId === event.id)
      .reduce((sum, it) => sum + it.quantity, 0);
  }, [cartItems, event.id]);
  const currentEventCartSummary = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const it of cartItems) {
      if (it.eventId !== event.id) continue;
      const name = (it.ticketName || "Standart").trim() || "Standart";
      grouped.set(name, (grouped.get(name) || 0) + Number(it.quantity || 0));
    }
    return Array.from(grouped.entries()).map(([name, quantity]) => ({ name, quantity }));
  }, [cartItems, event.id]);

  // Grup biletinde adet minimumun altındaysa yukarı çek (sayfa ilk yüklendiğinde veya bilet türü değişince)
  useEffect(() => {
    const minQ = Math.min(selectedMinQ, selectedMaxQ);
    if (minQ > 1 && ticketCount < minQ) setTicketCount(minQ);
  }, [selectedTicketType, selectedMinQ, selectedMaxQ]);

  /** Seçili bilet satırı artık stokta yoksa (ör. tükenmiş eski "VIP Bilet") geçerli ilk satıra sıçar. */
  useEffect(() => {
    if (availableTickets.length === 0) {
      if (selectedTicketType !== "") setSelectedTicketType("");
      return;
    }
    if (!availableTickets.some((t) => t.id === selectedTicketType)) {
      setSelectedTicketType(availableTickets[0]!.id);
      setTicketCount(1);
    }
  }, [availableTickets, selectedTicketType]);

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
          supabase.from("seating_plan_sections").select("id, name, ticket_type_label, section_align").eq("seating_plan_id", seatingPlanId).order("sort_order"),
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
        const seats = await fetchAllSeatsByRowIds<{
          id: string;
          row_id: string;
          seat_label: string;
          sales_blocked?: boolean | null;
        }>(supabase, rows.map((r) => r.id), "id, row_id, seat_label, sales_blocked");
        if (cancelled) return;
        const rowsBySection = new Map<string, SeatPlanRow[]>();
        rows.forEach((r) => {
          const list = rowsBySection.get(r.section_id) || [];
          const rowSeats = seats
            .filter((s) => s.row_id === r.id)
            .map((s) => ({
              id: s.id,
              seat_label: s.seat_label,
              sales_blocked: (s as { sales_blocked?: boolean | null }).sales_blocked === true,
            }))
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
            section_align: (s as { section_align?: "left" | "center" | "right" | null }).section_align ?? null,
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

  const fetchHeldByOthersSeats = useCallback(async () => {
    if (!event?.id || !hasSeatingPlan) return;
    try {
      const sid = ensureSeatHoldSessionId(seatHoldSessionId);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const q = new URLSearchParams({ event_id: event.id });
      if (sid) q.set("session_id", sid);
      const res = await fetch(`/api/seat-holds?${q.toString()}`, {
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      });
      const data = (await res.json().catch(() => null)) as { heldByOthersSeatIds?: string[] } | null;
      const ids = Array.isArray(data?.heldByOthersSeatIds) ? data!.heldByOthersSeatIds : [];
      setHeldByOthersSeatIds(new Set(ids));
    } catch {
      setHeldByOthersSeatIds(new Set());
    }
  }, [event?.id, hasSeatingPlan, seatHoldSessionId]);

  useEffect(() => {
    fetchSoldSeats();
    void fetchHeldByOthersSeats();
  }, [fetchSoldSeats, fetchHeldByOthersSeats]);

  useEffect(() => {
    if (!event?.id || !hasSeatingPlan) return;
    const onFocus = () => {
      fetchSoldSeats();
      void fetchHeldByOthersSeats();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [event?.id, hasSeatingPlan, fetchSoldSeats, fetchHeldByOthersSeats]);

  useEffect(() => {
    if (!event?.id || !hasSeatingPlan) return;
    const id = window.setInterval(() => {
      void fetchHeldByOthersSeats();
    }, 7000);
    return () => window.clearInterval(id);
  }, [event?.id, hasSeatingPlan, fetchHeldByOthersSeats]);

  const musensaalIdMaps = useMemo(() => {
    if (!isMusensaalPlan || !seatingPlanData?.length) return null;
    return buildMusensaalIdMaps(seatingPlanData);
  }, [isMusensaalPlan, seatingPlanData]);

  const salesBlockedSeatIds = useMemo(() => {
    const ids = new Set<string>();
    seatingPlanData?.forEach((sec) =>
      sec.rows.forEach((row) =>
        row.seats.forEach((seat) => {
          if (seat.sales_blocked) ids.add(seat.id);
        })
      )
    );
    return ids;
  }, [seatingPlanData]);

  const musensaalSelectableIds = useMemo(() => {
    if (!musensaalIdMaps) return undefined;
    const out = new Set<string>();
    for (const logicalId of musensaalIdMaps.logicalToDbId.keys()) {
      const dbId = musensaalIdMaps.logicalToDbId.get(logicalId);
      if (dbId && !salesBlockedSeatIds.has(dbId)) out.add(logicalId);
    }
    return out;
  }, [musensaalIdMaps, salesBlockedSeatIds]);

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
  }, [seatingPlanData, availableTickets, duisburgSeatCaptionById, rowLabelWord, seatLabelWord]);

  const seatCategoryHexBySeatId = useMemo(() => {
    const m = new Map<string, string>();
    if (!seatingPlanData) return m;
    /**
     * Renk, etkinliğin bilet adından değil, salon planındaki bölümün kategorisinden belirlenir.
     * Bu sayede Salon Yapım Wizard'da seçilen "VIP / Kategori 1 / Kategori 2 …" renkleri satış sayfasında
     * tıpatıp aynı şekilde görünür; etkinliğe eklenen bilet türlerinin isminden bağımsız çalışır.
     *
     * Öncelik sırası: row.ticket_type_label → section.ticket_type_label → section.name'in tire sonrası kısmı → section.name.
     */
    for (const sec of seatingPlanData) {
      const secLabel = String(sec.ticket_type_label || "").trim();
      const secName = String(sec.name || "");
      const dashIdx = secName.lastIndexOf(" - ");
      const fromName = dashIdx > 0 ? secName.slice(dashIdx + 3).trim() : "";
      const fallback = secLabel || fromName || secName.trim();
      for (const row of sec.rows) {
        const rowLabel = String(row.ticket_type_label || "").trim();
        const key = rowLabel || fallback;
        const hex = getTicketCategoryColorHex(key);
        for (const seat of row.seats) {
          m.set(seat.id, hex);
        }
      }
    }
    return m;
  }, [seatingPlanData]);

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
      if (heldByOthersSeatIds.has(seatId)) {
        m.set(
          seatId,
          locale === "de"
            ? "Dieser Platz wird aktuell von einem anderen Kunden reserviert."
            : locale === "en"
            ? "This seat is currently reserved by another customer."
            : "Bu koltuk şu anda başka bir kullanıcı tarafından rezerve edilmiş."
        );
        return;
      }
      const price = formatPrice(Number(meta.ticket?.price || 0), event.currency);
      const tname = shortenTicketDisplayName(meta.ticket?.name || "Bilet");
      m.set(seatId, `${tname} · ${meta.venueLine} · ${price}`);
    });
    return m;
  }, [seatMetaById, event.currency, heldByOthersSeatIds, locale]);

  const handleSeatToggle = useCallback(
    async (seatId: string) => {
      if (heldByOthersSeatIds.has(seatId)) {
        setActionMessage(
          locale === "de"
            ? "Dieser Platz wird aktuell von einem anderen Kunden reserviert."
            : locale === "en"
            ? "This seat is currently reserved by another customer."
            : "Bu koltuk şu anda başka bir kullanıcı tarafından rezerve edilmiş."
        );
        return;
      }
      if (seatActionPendingIdsRef.current.has(seatId)) {
        setActionMessage(
          locale === "de"
            ? "Platzaktion läuft, bitte kurz warten."
            : locale === "en"
            ? "Seat action in progress, please wait."
            : "Koltuk islemi suruyor, lutfen kisa bir sure bekleyin."
        );
        return;
      }
      if (salesBlockedSeatIds.has(seatId)) {
        setActionMessage(
          locale === "de"
            ? "Der gewahlte Platz ist bereits blockiert."
            : locale === "en"
            ? "The selected seat is currently blocked."
            : "Sectiginiz koltuk su anda bloke durumda."
        );
        return;
      }
      const sessionId = ensureSeatHoldSessionId(seatHoldSessionId);
      if (!sessionId) {
        setActionMessage(
          locale === "de"
            ? "Sitzungs-ID konnte nicht erstellt werden. Bitte Seite neu laden."
            : locale === "en"
            ? "Could not initialize session. Please refresh the page."
            : "Oturum olusturulamadi. Lutfen sayfayi yenileyin."
        );
        return;
      }
      seatActionPendingIdsRef.current.add(seatId);
      if (sessionId !== seatHoldSessionId) setSeatHoldSessionId(sessionId);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const seatHoldHeaders: HeadersInit = {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      };
      const inCartOnly = cartSeatIdsForEvent.has(seatId) && !selectedSeatIds.has(seatId);
      const isSelected = selectedSeatIds.has(seatId) || inCartOnly;

      try {
        if (isSelected) {
          const wasCartOnly = inCartOnly && !selectedSeatIds.has(seatId);
          if (selectedSeatIds.has(seatId)) {
            setSelectedSeatIds((prev) => {
              const next = new Set(prev);
              next.delete(seatId);
              return next;
            });
          }
          removeSeatItem(event.id, seatId);
          try {
            const releaseRes = await fetch("/api/seat-holds", {
              method: "DELETE",
              headers: seatHoldHeaders,
              body: JSON.stringify({ eventId: event.id, seatId, sessionId }),
            });
            if (wasCartOnly) {
              setActionMessage(
                locale === "de"
                  ? "Dieser Platz war in einem alten Warenkorb markiert. Falls ihn inzwischen jemand anderes reserviert hat, wählen Sie bitte einen anderen Platz."
                  : locale === "en"
                  ? "This seat was marked in an old cart. If another user has reserved it, please choose a different seat."
                  : "Bu koltuk eski bir sepetten işaretliydi. Bu sırada başka bir kullanıcı rezervasyon aldıysa lütfen farklı bir koltuk seçin."
              );
            } else if (!releaseRes.ok) {
              setActionMessage(
                locale === "de"
                  ? "Platz konnte nicht freigegeben werden. Bitte erneut versuchen."
                  : locale === "en"
                  ? "Could not release the seat. Please try again."
                  : "Koltuk birakilamadi. Lutfen tekrar deneyin."
              );
            }
          } catch {
            if (wasCartOnly) {
              setActionMessage(
                locale === "de"
                  ? "Dieser Platz war in einem alten Warenkorb markiert. Bitte wählen Sie den Platz erneut."
                  : locale === "en"
                  ? "This seat was marked in an old cart. Please select it again."
                  : "Bu koltuk eski bir sepetten işaretliydi. Lütfen koltuğu tekrar seçin."
              );
            }
          }
          return;
        }

        if (heldSeatIds.size >= maxTicketsPerOrder) {
          setActionMessage(
            locale === "de"
              ? `Max. ${maxTicketsPerOrder} Platze pro Bestellung.`
              : locale === "en"
              ? `Maximum ${maxTicketsPerOrder} tickets per order.`
              : `Siparis basina en fazla ${maxTicketsPerOrder} bilet alabilirsiniz.`
          );
          return;
        }

        if (selectableSeatIdsByCategory && !selectableSeatIdsByCategory.has(seatId)) {
          setActionMessage(
            locale === "de"
              ? "Bitte wählen Sie einen Platz aus der ausgewählten Preiskategorie."
              : locale === "en"
              ? "Please choose a seat from the selected price category."
              : "Lutfen secili fiyat kategorisinden bir koltuk secin."
          );
          return;
        }
        const res = await fetch("/api/seat-holds", {
          method: "POST",
          headers: seatHoldHeaders,
          body: JSON.stringify({ seatId, eventId: event.id, sessionId }),
        });
        if (!res.ok) {
          const failData = (await res.json().catch(() => null)) as { error?: string } | null;
          setActionMessage(
            failData?.error?.trim() ||
              (locale === "de"
                ? "Der gewahlte Platz ist leider bereits verkauft oder reserviert."
                : locale === "en"
                ? "The selected seat is unfortunately already sold or reserved."
                : "Seçtiğiniz koltuk şu anda başka bir kullanıcı tarafından tutuluyor veya satıldı.")
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
          const priceText = formatPrice(Number(ticketForCart.price || 0), event.currency);
          setActionMessage(
            locale === "de"
              ? `Ticketpreis: ${priceText} - zum Warenkorb hinzugefügt.`
              : locale === "en"
              ? `Ticket price: ${priceText} - added to cart.`
              : `Bilet fiyatı: ${priceText} - sepete eklendi.`
          );
        }
      } catch {
        setActionMessage(
          locale === "de"
            ? "Platz konnte nicht reserviert werden."
            : locale === "en"
            ? "Could not reserve the seat."
            : "Koltuk rezerve edilemedi."
        );
      } finally {
        seatActionPendingIdsRef.current.delete(seatId);
      }
    },
    [
      addItem,
      availableTickets,
      cartSeatIdsForEvent,
      event,
      heldSeatIds,
      heldByOthersSeatIds,
      locale,
      localized.title,
      maxTicketsPerOrder,
      removeSeatItem,
      seatHoldSessionId,
      seatMetaById,
      salesBlockedSeatIds,
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
        <div className="site-container py-8">
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
                {whereLine ? (
                  <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-1.5">
                    <MapPin className="h-4 w-4" />
                    {whereLine}
                  </span>
                ) : null}
                {organizerDisplayName && (
                  <span className="inline-flex items-center gap-2 rounded-md bg-primary-50 px-3 py-1.5 text-primary-700">
                    <Users className="h-4 w-4" />
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
      <div className="site-container py-10">
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
                      <Ticket className="h-10 w-10" />
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
                      <DoorOpen className="h-10 w-10" />
                    </span>
                    <div className="min-w-0">
                      <span className="block font-bold text-lg">{t("saalplanbuchung")}</span>
                      <span className="mt-1 block text-sm opacity-90">{t("saalplanbuchungDesc")}</span>
                    </div>
                  </button>
                </div>
              )}
              {!isExternalOnlyEvent && bookingMode === null && (
                <p className="mb-8 text-sm text-slate-600">
                  {locale === "de"
                    ? "Bitte wählen Sie eine Buchungsart."
                    : locale === "en"
                    ? "Please choose a booking method."
                    : "Lütfen bir bilet alma yöntemi seçin."}
                </p>
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
                        {availableTickets.length === 0 && (
                          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                            <strong>Bilet stoku yok.</strong> Koltukları işaretleyebilirsiniz; sepete eklemek için yönetimde bu etkinlik için en az bir bilet türü tanımlayıp adedi 0&apos;dan büyük yapın.
                          </div>
                        )}
                        <p className="text-sm text-slate-600 mb-3">
                          Bölüm ve koltuk seçin. Renkler, etkinlik bilet adıyla eşleşen kategoriye göredir.
                        </p>
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
                          {selectedSeatCategory !== "all" ? (
                            <button
                              type="button"
                              onClick={() => setSelectedSeatCategory("all")}
                              className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              {locale === "de" ? "Filter zurücksetzen" : locale === "en" ? "Reset filter" : "Filtreyi temizle"}
                            </button>
                          ) : null}
                        </div>
                        {actionMessage ? (
                          <p
                            className={`mb-4 rounded-lg px-3 py-2 text-sm ${
                              /another customer|anderen kunden|başka bir kullanıcı/i.test(actionMessage)
                                ? "border border-slate-900 bg-slate-900 font-semibold text-white"
                                : "border border-slate-300 bg-white font-semibold text-slate-900"
                            }`}
                          >
                            {actionMessage}
                          </p>
                        ) : null}
                        {seatMapView === "map" && (
                          <div className="mb-4">
                            {isMusensaalPlan && musensaalIdMaps && getPlan("musensaal") ? (
                              <SalonPlanViewer
                                plan={getPlan("musensaal")!}
                                selectedIds={new Set(
                                  Array.from(heldSeatIds).map((id) => musensaalIdMaps.dbIdToLogical.get(id)).filter(Boolean) as string[]
                                )}
                                soldIds={new Set(
                                  Array.from(soldSeatIds).map((id) => musensaalIdMaps.dbIdToLogical.get(id)).filter(Boolean) as string[]
                                )}
                                selectableIds={musensaalSelectableIds}
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
                                selectedSeatIds={heldSeatIds}
                                soldSeatIds={soldSeatIds}
                                blockedSeatIds={salesBlockedSeatIds}
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
                                heldSeatIds={heldSeatIds}
                                soldSeatIds={soldSeatIds}
                                onSeatToggle={(seatId) => void handleSeatToggle(seatId)}
                                seatCategoryHexBySeatId={seatCategoryHexBySeatId}
                                selectableSeatIds={selectableSeatIdsByCategory}
                                salesBlockedSeatIds={salesBlockedSeatIds}
                                seatTitleById={seatTitleById}
                                stageLabel={stageLabel}
                                seatLabelWord={seatLabelWord}
                                availableTickets={availableTickets}
                                selectedSeatCategory={selectedSeatCategory}
                                onSelectSeatCategory={setSelectedSeatCategory}
                                locale={locale}
                                currency={event.currency}
                              />
                              </>
                            )}
                          </div>
                        )}
                        {seatMapView === "list" && (
                          <div className="space-y-4 max-h-[min(52vh,520px)] overflow-y-auto">
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
                                  {section.rows.map((row) => {
                                    const { ticket: rowTk } = getTicketForRow(section, row, sectionIdx, availableTickets);
                                    return (
                                    <div key={row.id} className="mb-3">
                                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1.5">
                                        <span className="text-sm font-medium text-slate-600 w-16 shrink-0">{rowLabelWord} {row.row_label}</span>
                                        <span className="text-xs font-semibold text-primary-800">{rowTk.name || "—"}</span>
                                        <span className="text-xs text-slate-500">
                                          {formatPrice(Number(rowTk.price || 0), event.currency)} / {seatLabelWord}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-1 pl-0 sm:pl-16">
                                        {row.seats.map((seat) => {
                                          const isHeld = heldSeatIds.has(seat.id);
                                          const isSold = soldSeatIds.has(seat.id);
                                          const isBlocked = salesBlockedSeatIds.has(seat.id);
                                          const handleClick = async () => {
                                            if (isSold || isBlocked) return;
                                            await handleSeatToggle(seat.id);
                                          };
                                          const catHex = seatCategoryHexBySeatId.get(seat.id) ?? "#64748b";
                                          const softFill = lightenHex(catHex, 0.4);
                                          const hoverFill = lightenHex(catHex, 0.25);
                                          const fluoFill = HELD_SEAT_FLUO;
                                          return (
                                            <button
                                              key={seat.id}
                                              type="button"
                                              disabled={
                                                isSold ||
                                                isBlocked ||
                                                (selectableSeatIdsByCategory ? !selectableSeatIdsByCategory.has(seat.id) : false)
                                              }
                                              onClick={handleClick}
                                              className={`w-9 h-9 rounded-full text-sm font-medium transition-colors outline-none focus-visible:outline-none ${
                                                isSold
                                                  ? "bg-slate-300 text-slate-700 cursor-not-allowed ring-0"
                                                  : isBlocked
                                                    ? "bg-amber-200 text-amber-950 cursor-not-allowed ring-1 ring-amber-400"
                                                  : selectableSeatIdsByCategory && !selectableSeatIdsByCategory.has(seat.id)
                                                    ? "bg-slate-300 text-slate-500 cursor-not-allowed ring-0"
                                                  : isHeld
                                                    ? "text-slate-900 cursor-pointer ring-0 shadow-none border-0"
                                                    : "text-slate-900 ring-0 border-0 hover:bg-[#39ff14] hover:text-slate-900"
                                              } ${!isHeld && !isSold && !isBlocked && heldSeatIds.size >= maxTicketsPerOrder ? "opacity-50 cursor-not-allowed" : ""}`}
                                              style={
                                                isSold || isBlocked || (selectableSeatIdsByCategory && !selectableSeatIdsByCategory.has(seat.id))
                                                  ? undefined
                                                  : isHeld
                                                    ? { backgroundColor: fluoFill }
                                                    : { backgroundColor: softFill }
                                              }
                                              onMouseEnter={(e) => {
                                                if (isSold || isBlocked || isHeld) return;
                                                if (selectableSeatIdsByCategory && !selectableSeatIdsByCategory.has(seat.id)) return;
                                                e.currentTarget.style.backgroundColor = hoverFill;
                                              }}
                                              onMouseLeave={(e) => {
                                                if (isSold || isBlocked || isHeld) return;
                                                if (selectableSeatIdsByCategory && !selectableSeatIdsByCategory.has(seat.id)) return;
                                                e.currentTarget.style.backgroundColor = softFill;
                                              }}
                                              title={
                                                seatTitleById.get(seat.id) ||
                                                (isSold ? `${seat.seat_label} (satıldı)` : isBlocked ? `${seat.seat_label} (satışa kapalı)` : undefined)
                                              }
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
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/*
                        Sağ: Deine Plätze sidebar
                        İki bölümlü tasarım — dil değişimi, sayfa yenileme veya sepet zaten doluyken
                        kullanıcının kafası karışmasın diye:
                          1) [Sepette]    → bu etkinlik için sepetteki koltuklar (her zaman görünür)
                          2) [Yeni seçim] → şu anda planda seçilen ama henüz sepete eklenmemiş koltuklar
                        Hiçbiri yoksa "Plandan koltuk seçin" mesajı çıkar.
                      */}
                      <aside className="lg:sticky lg:top-6 self-start rounded-xl border border-slate-200 bg-slate-50/80 p-4 h-fit">
                        <h3 className="text-sm font-bold text-slate-800 mb-3">{t("deinePlatze")}</h3>
                        {(() => {
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

                          type SeatLine = {
                            seatId: string;
                            venueLine: string;
                            price: number;
                            ticketId: string;
                            ticketName: string;
                          };

                          const buildSeatLine = (seatId: string): SeatLine => {
                            const sec = seatToSection.get(seatId);
                            const row = seatToRow.get(seatId);
                            const seat = sec?.rows.flatMap((r) => r.seats).find((s) => s.id === seatId);
                            const sectionIdx = sec ? seatingPlanData.indexOf(sec) : 0;
                            const { ticket: tk } = getTicketForRow(
                              sec ?? { id: "", name: "", rows: [] },
                              row,
                              sectionIdx,
                              availableTickets
                            );
                            const fallbackLine = `${sec?.name ?? "—"} · ${rowLabelWord} ${row?.row_label ?? "—"} · ${seatLabelWord} ${seat?.seat_label ?? "—"}`;
                            return {
                              seatId,
                              venueLine: duisburgSeatCaptionById.get(seatId) ?? fallbackLine,
                              price: Number(tk.price || 0),
                              ticketId: tk.id || "",
                              ticketName: tk.name || "Bilet",
                            };
                          };

                          // Yeni seçim listesi (henüz sepete eklenmemiş)
                          const selectedSeatsList: SeatLine[] = Array.from(selectedSeatIds).map(buildSeatLine);
                          // Sepetteki koltukların listesi (cart kaynağı tek doğruluk; etiketleri yerinde alır)
                          const cartSeatLineMap = new Map<string, SeatLine>();
                          for (const it of cartItems) {
                            if (it.eventId !== event.id) continue;
                            for (let i = 0; i < (it.seatIds || []).length; i++) {
                              const id = it.seatIds![i]!;
                              if (cartSeatLineMap.has(id)) continue;
                              const built = buildSeatLine(id);
                              cartSeatLineMap.set(id, {
                                ...built,
                                price:
                                  Number(it.price || 0) || built.price,
                                ticketName: (it.ticketName || built.ticketName) as string,
                                venueLine:
                                  (it.seatCaptions || [])[i] || built.venueLine,
                              });
                            }
                          }
                          const cartSeatsList: SeatLine[] = Array.from(cartSeatLineMap.values());

                          const selectedTotal = selectedSeatsList.reduce(
                            (sum, s) => sum + s.price,
                            0
                          );
                          const cartTotal = cartSeatsList.reduce(
                            (sum, s) => sum + s.price,
                            0
                          );
                          const processingFee =
                            typeof event.checkout_processing_fee === "number" &&
                            event.checkout_processing_fee > 0
                              ? Number(event.checkout_processing_fee)
                              : 0;
                          const atSeatLimit = selectedSeatIds.size >= maxTicketsPerOrder;

                          const seatIdsByTicketId = new Map<string, string[]>();
                          selectedSeatsList.forEach((s) => {
                            if (!s.ticketId) return;
                            const arr = seatIdsByTicketId.get(s.ticketId) ?? [];
                            arr.push(s.seatId);
                            seatIdsByTicketId.set(s.ticketId, arr);
                          });

                          if (cartSeatsList.length === 0 && selectedSeatsList.length === 0) {
                            return (
                              <p className="text-sm text-slate-500 py-4">
                                {locale === "de"
                                  ? "Wählen Sie Plätze im Plan."
                                  : locale === "en"
                                  ? "Select seats from the seating plan."
                                  : "Plandan koltuk seçin."}
                              </p>
                            );
                          }

                          const cartBadge =
                            locale === "de" ? "Im Warenkorb" : locale === "en" ? "In cart" : "Sepette";
                          const newSelectionBadge =
                            locale === "de"
                              ? "Neue Auswahl"
                              : locale === "en"
                              ? "New selection"
                              : "Yeni seçim";
                          const goToCart =
                            locale === "de"
                              ? "Zum Warenkorb"
                              : locale === "en"
                              ? "Go to cart"
                              : "Sepete git";

                          return (
                            <>
                              {cartSeatsList.length > 0 && (
                                <section className="mb-4">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                      {cartBadge} ({cartSeatsList.length})
                                    </span>
                                    <span className="text-xs font-semibold text-slate-700">
                                      {formatPrice(cartTotal, event.currency)}
                                    </span>
                                  </div>
                                  <ul className="space-y-2">
                                    {cartSeatsList.map((item) => (
                                      <li
                                        key={`cart-${item.seatId}`}
                                        className="flex items-center justify-between gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm"
                                      >
                                        <span className="text-slate-700 truncate" title={item.venueLine}>
                                          {item.venueLine}
                                        </span>
                                        <span className="font-semibold text-emerald-700 flex-shrink-0">
                                          {formatPrice(item.price, event.currency)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            void handleSeatToggle(item.seatId);
                                          }}
                                          className="text-slate-400 hover:text-red-600 p-1 flex-shrink-0"
                                          aria-label="Kaldır"
                                          title={
                                            locale === "de"
                                              ? "Aus Warenkorb entfernen"
                                              : locale === "en"
                                              ? "Remove from cart"
                                              : "Sepetten çıkar"
                                          }
                                        >
                                          ×
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                  <NextLink
                                    href={`/${locale}/sepet`}
                                    prefetch={false}
                                    className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                                  >
                                    {goToCart} ({cartSeatsList.length})
                                  </NextLink>
                                </section>
                              )}

                              {selectedSeatsList.length > 0 && (
                                <section
                                  className={
                                    cartSeatsList.length > 0
                                      ? "border-t border-slate-200 pt-4"
                                      : ""
                                  }
                                >
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-800">
                                      {newSelectionBadge} ({selectedSeatsList.length})
                                    </span>
                                    <span className="text-xs font-semibold text-slate-700">
                                      {formatPrice(selectedTotal, event.currency)}
                                    </span>
                                  </div>
                                  <ul className="space-y-2">
                                    {selectedSeatsList.map((item) => (
                                      <li
                                        key={`sel-${item.seatId}`}
                                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm shadow-sm"
                                      >
                                        <span className="text-slate-700 truncate" title={item.venueLine}>
                                          {item.venueLine}
                                        </span>
                                        <span className="font-semibold text-primary-600 flex-shrink-0">
                                          {formatPrice(item.price, event.currency)}
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
                                  {availableTickets.length > 0 ? (
                                    <>
                                      {atSeatLimit && (
                                        <p className="mt-2 text-xs text-amber-600">
                                          {locale === "de"
                                            ? `Max. ${maxTicketsPerOrder} Plätze pro Bestellung.`
                                            : `Sipariş başına en fazla ${maxTicketsPerOrder} bilet.`}
                                        </p>
                                      )}
                                      <div className="mt-3 mb-3 space-y-1 text-sm text-slate-700">
                                        <p>
                                          <strong>{selectedSeatIds.size}</strong>{" "}
                                          {locale === "de"
                                            ? "Platze Gewahlt"
                                            : locale === "en"
                                            ? "Seats Selected"
                                            : "Koltuk Seçildi"}{" "}
                                          <strong>
                                            {locale === "de"
                                              ? "Gesamt"
                                              : locale === "en"
                                              ? "Total"
                                              : "Toplam"}{" "}
                                            {formatPrice(selectedTotal, event.currency)}
                                          </strong>
                                        </p>
                                        <p>
                                          {locale === "de"
                                            ? "Bearbeitungsgebuhr"
                                            : locale === "en"
                                            ? "Processing Fee"
                                            : "İşlem Ücreti"}{" "}
                                          <strong>{formatPrice(processingFee, event.currency)}</strong>
                                        </p>
                                        <p className="font-semibold text-slate-900">
                                          {locale === "de"
                                            ? "Gesamtsumme"
                                            : locale === "en"
                                            ? "Grand Total"
                                            : "Genel Toplam"}{" "}
                                          {formatPrice(selectedTotal + processingFee, event.currency)}
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
                                  ) : (
                                    <p className="mt-3 text-sm text-rose-800 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                                      Satışta bilet yok; sepete eklenemez. Yönetimden bilet stoğu açın veya
                                      &quot;Fiyat kategorisine göre&quot; modunu kullanın.
                                    </p>
                                  )}
                                </section>
                              )}
                            </>
                          );
                        })()}
                      </aside>
                    </div>
                  ) : (
                    <p className="text-slate-500">Bu plan için henüz bölüm/sıra/koltuk tanımlanmamış.</p>
                  )}
                </div>
              )}

              {/* Bilet Türleri - Fiyat kategorisine göre: yer seçimi ile aynı sağ panel akışı */}
              {!isExternalOnlyEvent && bookingMode === "price" && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                  <div>
                    {availableTickets.length === 0 ? (
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
                          {availableTickets.map((ticketType) => {
                            const availableAmount = Number(ticketType.available || 0);
                            const isSoldOut = availableAmount <= 0;
                            if (isSoldOut) {
                              return (
                                <div
                                  key={ticketType.id}
                                  className="flex items-center justify-between gap-4 bg-slate-50 px-5 py-4 cursor-default"
                                >
                                  <div>
                                    <p className="text-sm font-semibold text-slate-700">{ticketType.name}</p>
                                    <p className="text-xs text-slate-500">{t("remaining")}: 0</p>
                                  </div>
                                  <p className="text-lg font-bold text-slate-400">{formatPrice(ticketType.price, event.currency)}</p>
                                  <div className="flex min-w-[100px] items-center justify-end">
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
                            const selectedRowCount = isSelected ? ticketCount : 0;
                            const cartQtyForTicket = cartItems
                              .filter((it) => it.eventId === event.id && it.ticketId === ticketType.id)
                              .reduce((sum, it) => sum + it.quantity, 0);
                            // Kullanıcıya tutarlı görünmesi için, varsa sepetteki gerçek adedi göster.
                            const rowCount = cartQtyForTicket > 0 ? cartQtyForTicket : selectedRowCount;

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
                                      disabled={availableAmount <= 0 || isPastEvent || selectedRowCount <= effectiveMin}
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
                                      disabled={availableAmount <= 0 || isPastEvent || selectedRowCount >= maxSelectable}
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
                    )}

                    <div className="border-t pt-6">
                      <div className="mb-6 flex items-center justify-between">
                        <span className="text-lg font-semibold text-slate-900">{t("totalPrice")}</span>
                        <span className="text-3xl font-bold text-primary-700">
                          {formatPrice(totalPrice, event.currency)}
                        </span>
                      </div>

                      {isPastEvent && (
                        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                          {t("eventEnded")}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (!selectedTicket || isPastEvent || isUnapproved) return;
                          const minQ = Math.min(selectedMinQ, selectedMaxQ);
                          if (ticketCount < minQ) return;
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
                    </div>
                  </div>

                  <aside className="rounded-2xl border border-slate-200 bg-white p-5 h-fit">
                    <h3 className="mb-4 text-lg font-bold text-slate-900">{t("deinePlatze")}</h3>
                    {currentEventCartSummary.length > 0 ? (
                      <div className="space-y-2">
                        <ul className="space-y-1 text-sm text-slate-700">
                          {currentEventCartSummary.map((item, idx) => (
                            <li key={`price-cat-cart-side-${item.name}-${idx}`}>
                              {idx + 1}. {item.name} x {item.quantity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : selectedTicket ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600">
                          Bilet kategorisi: <strong>{shortenTicketDisplayName(selectedTicket.name || selectedTicket.ticket_type || "Standart")}</strong>
                        </p>
                        <ul className="space-y-1 text-sm text-slate-700">
                          {Array.from({ length: ticketCount }).map((_, idx) => (
                            <li key={`price-cat-selected-side-${idx}`}>
                              {idx + 1}. {shortenTicketDisplayName(selectedTicket.name || selectedTicket.ticket_type || "Standart")} x 1
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        {locale === "de"
                          ? "Wählen Sie eine Ticketkategorie und Menge."
                          : locale === "en"
                            ? "Select a ticket category and quantity."
                            : "Bir bilet kategorisi ve adet seçin."}
                      </p>
                    )}

                    {currentEventCartCount > 0 ? (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-sm font-semibold text-emerald-800">
                          {locale === "de"
                            ? "Für diese Veranstaltung befinden sich bereits Tickets in Ihrem Warenkorb."
                            : locale === "en"
                              ? "You already have tickets for this event in your cart."
                              : "Bu etkinlik için sepetinizde biletler bulunmaktadır."}
                        </p>
                        <p className="mt-1 text-xs text-emerald-700">
                          {locale === "de"
                            ? "Gehen Sie zum Warenkorb, um die Zahlung abzuschließen. Sie können weitere Tickets hinzufügen, sofern Ihr Limit es zulässt."
                            : locale === "en"
                              ? "Go to your cart to complete payment. You can add more tickets if your order limit allows."
                              : "Ödemeyi tamamlamak için sepete gidin. Kotanız uygunsa ek bilet de seçebilirsiniz."}
                        </p>
                      </div>
                    ) : null}

                    {totalItems > 0 && (
                      <NextLink
                        href={`/${locale}/sepet`}
                        prefetch={false}
                        className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
                      >
                        {tCheckout("goToCheckout")} ({currentEventCartCount > 0 ? currentEventCartCount : totalItems})
                      </NextLink>
                    )}
                  </aside>
                </div>
              )}
            </div>

            {/* Etkinlik Hakkında – düzenli içerik + sağ özet panel */}
            <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t("aboutEvent")}</h2>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {locale === "de" ? "Information" : locale === "en" ? "Information" : "Bilgilendirme"}
                  </span>
                </div>
                <div className="prose prose-slate max-w-none">
                  <p className="whitespace-pre-line text-[15px] leading-7 text-slate-700">
                    {parsedDescription.content || t("aboutPlaceholder")}
                  </p>
                </div>
              </section>

              <aside className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 h-fit">
                <h3 className="mb-4 text-base font-bold text-slate-900">
                  {locale === "de" ? "Auf einen Blick" : locale === "en" ? "At a glance" : "Hızlı Özet"}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {locale === "de" ? "Datum" : locale === "en" ? "Date" : "Tarih"}
                      </p>
                      <p className="text-sm font-medium text-slate-800">{formatEventDateDMY(event.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {locale === "de" ? "Uhrzeit" : locale === "en" ? "Time" : "Saat"}
                      </p>
                      <p className="text-sm font-medium text-slate-800">{event.time || "20:00"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {locale === "de" ? "Veranstaltungsort" : locale === "en" ? "Venue" : "Mekan"}
                      </p>
                      <p className="text-sm font-medium text-slate-800">{localized.venue || event.venue}</p>
                    </div>
                  </div>
                  {(event.address ?? "").trim() !== "" && (
                    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {locale === "de" ? "Adresse" : locale === "en" ? "Address" : "Adres"}
                        </p>
                        <p className="text-sm font-medium text-slate-800">{(event.address ?? "").trim()}</p>
                      </div>
                    </div>
                  )}
                  {(event.city ?? "").trim() !== "" && (
                    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {locale === "de" ? "Stadt" : locale === "en" ? "City" : "Şehir"}
                        </p>
                        <p className="text-sm font-medium text-slate-800">{(event.city ?? "").trim()}</p>
                      </div>
                    </div>
                  )}
                  {(event.address ?? "").trim() === "" &&
                    (event.city ?? "").trim() === "" &&
                    (event.location ?? "").trim() !== "" && (
                      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {locale === "de" ? "Standort" : locale === "en" ? "Location" : "Konum"}
                          </p>
                          <p className="text-sm font-medium text-slate-800">{(event.location ?? "").trim()}</p>
                        </div>
                      </div>
                    )}
                  {organizerDisplayName && (
                    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {locale === "de" ? "Veranstalter" : locale === "en" ? "Organizer" : "Organizatör"}
                        </p>
                        <p className="text-sm font-medium text-slate-800">{organizerDisplayName}</p>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>

            {/* Mekan Bilgisi – tek blokta düzen */}
            {venue && (
              <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t("venueInfo")}</h2>
                  <NextLink
                    href={`/${locale}/mekanlar`}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    {t("allVenues")} →
                  </NextLink>
                </div>
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="space-y-5">
                    {venuePhotoUrls.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                        <h3 className="mb-2 text-base font-bold text-slate-900">
                          {locale === "de" ? "Fotos" : locale === "en" ? "Photos" : "Fotoğraflar"}
                        </h3>
                        <p className="mb-3 text-sm text-slate-500">
                          {locale === "de"
                            ? "Tippen zum Vergrößern · Pfeiltasten in der Galerie"
                            : locale === "en"
                            ? "Tap to enlarge · Arrow keys in gallery"
                            : "Büyütmek için tıklayın · Galeride ok tuşları"}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {venuePhotoUrls.map((url, idx) => (
                            <button
                              key={`${url}-${idx}`}
                              type="button"
                              onClick={() => setVenueGalleryIndex(idx)}
                              className="group relative h-16 w-24 overflow-hidden rounded-md border border-slate-200 bg-slate-100 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:h-20 sm:w-28"
                              aria-label={
                                locale === "en"
                                  ? `Open photo ${idx + 1} in gallery`
                                  : locale === "de"
                                  ? `Foto ${idx + 1} in Galerie öffnen`
                                  : `Fotoğraf ${idx + 1} galeride aç`
                              }
                            >
                              <img
                                src={url}
                                alt={`${venue.name} – ${idx + 1}`}
                                className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {venue.transport_info && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                        <div className="mb-1 flex items-center gap-2">
                          <Car className="h-4 w-4 text-primary-600" />
                          <h3 className="text-base font-bold text-slate-900">{t("transport")}</h3>
                        </div>
                        <div
                          className="prose prose-sm max-w-none text-slate-700 [&_p]:my-1 [&_ul]:my-2"
                          dangerouslySetInnerHTML={{ __html: venue.transport_info }}
                        />
                      </div>
                    )}
                    {(() => {
                      const mapUrl = extractMapEmbedUrl(venue.map_embed_url);
                      return mapUrl ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                          <h3 className="mb-2 text-base font-bold text-slate-900">{t("map")}</h3>
                          <div className="h-40 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 sm:h-52">
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
                    {venue.faq.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                        <button
                          onClick={() => setVenueFaqOpen((o) => !o)}
                          className="flex items-center gap-2 text-slate-900 font-semibold hover:text-primary-600"
                        >
                          <HelpCircle className="h-5 w-5" />
                          {t("faq")}
                          {venueFaqOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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

                  <aside className="space-y-4">
                    {venue.entrance_info && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="mb-1 flex items-center gap-2">
                          <DoorOpen className="h-4 w-4 text-primary-600" />
                          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800">{t("entranceInfo")}</h3>
                        </div>
                        <p className="text-sm leading-6 text-slate-700">{venue.entrance_info}</p>
                      </div>
                    )}
                    {venue.rules && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-800">{t("entranceRules")}</h3>
                        <p className="text-sm leading-6 text-slate-700">{venue.rules}</p>
                      </div>
                    )}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs leading-relaxed text-slate-600">
                        {locale === "de"
                          ? "Hinweis: Sitzplatzauswahl und Ticketkategorien finden Sie oben im Bereich Buchung."
                          : locale === "en"
                          ? "Note: Seat selection and ticket categories are available above in the booking area."
                          : "Not: Koltuk seçimi ve bilet kategorileri sayfanın üstündeki rezervasyon alanındadır."}
                      </p>
                    </div>
                  </aside>
                </div>
              </section>
            )}

            {/* Bilet hatırlatıcısı + Güvenli alışveriş */}
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

        {venueGalleryIndex !== null && venuePhotoUrls.length > 0 && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={locale === "en" ? "Photo gallery" : locale === "de" ? "Fotogalerie" : "Foto galerisi"}
            onClick={() => setVenueGalleryIndex(null)}
          >
            <button
              type="button"
              className="absolute right-3 top-3 rounded-full bg-white/15 p-2 text-white hover:bg-white/25"
              aria-label={locale === "en" ? "Close" : locale === "de" ? "Schließen" : "Kapat"}
              onClick={() => setVenueGalleryIndex(null)}
            >
              <X className="h-6 w-6" />
            </button>
            {venueGalleryIndex > 0 && (
              <button
                type="button"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 sm:left-4"
                aria-label={locale === "en" ? "Previous" : locale === "de" ? "Zurück" : "Önceki"}
                onClick={(e) => {
                  e.stopPropagation();
                  setVenueGalleryIndex((i) => (i !== null && i > 0 ? i - 1 : i));
                }}
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
            )}
            {venueGalleryIndex < venuePhotoUrls.length - 1 && (
              <button
                type="button"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-2 text-white hover:bg-white/25 sm:right-4"
                aria-label={locale === "en" ? "Next" : locale === "de" ? "Weiter" : "Sonraki"}
                onClick={(e) => {
                  e.stopPropagation();
                  setVenueGalleryIndex((i) =>
                    i !== null && i < venuePhotoUrls.length - 1 ? i + 1 : i
                  );
                }}
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            )}
            <img
              src={venuePhotoUrls[venueGalleryIndex]}
              alt=""
              className="max-h-[min(85vh,900px)] max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
