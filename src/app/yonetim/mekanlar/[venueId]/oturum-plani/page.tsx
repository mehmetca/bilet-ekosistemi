"use client";

import { Suspense, useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus, ChevronDown, ChevronRight, Copy, Trash2, Ban } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { fetchAllSeatsByRowIds } from "@/lib/fetch-all-seats-by-row-ids";
import OrganizerOrAdminGuard from "@/components/OrganizerOrAdminGuard";
import { getMusensaalTemplateCopy } from "@/lib/seating-plans/musensaal-to-db";
import { getPlan } from "@/lib/seating-plans";
import SalonPlanViewer from "@/components/SalonPlanViewer";
import TicketTypeLabelSelect from "@/components/TicketTypeLabelSelect";
import type { SeatingPlan, SeatingPlanSection, SeatingPlanRow, Seat } from "@/types/database";
import SeatingKonvaRowEditor, { type SeatingKonvaRowEditorProps } from "@/components/SeatingKonvaRowEditor";
import { planSectionsMatchMusensaalTemplate } from "@/lib/seating-plans/musensaal-structure-match";
import {
  ROW_EDITOR_GAP,
  ROW_EDITOR_GRID_BASE_X,
  ROW_EDITOR_GRID_CENTER_Y,
} from "@/lib/seating-plans/row-editor-grid";
import {
  SALON_PRESET_OPTIONS,
  buildSalonPresetDraft,
  presetUsesFlankCount,
  presetUsesSideDimensions,
  type SalonPresetCorridorMode,
  type SalonPresetId,
} from "@/lib/seating-plans/salon-layout-presets";

/** Konva satır başına; doğrudan import (dynamic chunk → çift React / useState hatası). */
function LazySeatingKonvaRowEditor(props: SeatingKonvaRowEditorProps) {
  const [show, setShow] = useState(false);
  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="mt-2 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Koltuk yerleşimini aç (sürükle-bırak) — <span className="font-normal text-slate-500">çok sıra varsa performans için</span>
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setShow(false)}
        className="text-xs text-slate-600 underline hover:text-slate-900"
      >
        Görsel düzeni gizle
      </button>
      <SeatingKonvaRowEditor {...props} />
    </div>
  );
}

function planHasMusensaalStructure(sections: SeatingPlanSection[]): boolean {
  return planSectionsMatchMusensaalTemplate(sections);
}

function sortSeatsByLabel(seats: Seat[]) {
  return [...seats].sort((a, b) => {
    const na = Number(String(a.seat_label).trim());
    const nb = Number(String(b.seat_label).trim());
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum) return na - nb;
    return String(a.seat_label).localeCompare(String(b.seat_label), undefined, { numeric: true });
  });
}

/** Sıra editöründe elle taşınmamışsa koltukları varsayılan ızgaraya hizalar; aksi halde `seats` aynı referansla döner. */
function alignSeatsToGridIfStillDefault(seats: Seat[]): Seat[] {
  if (seats.length === 0) return seats;
  const sorted = sortSeatsByLabel(seats);
  const baseX = ROW_EDITOR_GRID_BASE_X;
  const gap = ROW_EDITOR_GAP;
  const centerY = ROW_EDITOR_GRID_CENTER_Y;
  const tolerance = 1;
  const hasCustomLayout = sorted.some((seat, idx) => {
    const sx = Number(seat.x);
    const sy = Number(seat.y);
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) return false;
    const expectedX = baseX + idx * gap;
    const expectedY = centerY;
    return Math.abs(sx - expectedX) > tolerance || Math.abs(sy - expectedY) > tolerance;
  });
  if (hasCustomLayout) return seats;
  const byId = new Map(sorted.map((seat, i) => [seat.id, { x: baseX + i * gap, y: centerY }]));
  return seats.map((seat) => {
    const pos = byId.get(seat.id);
    return pos ? { ...seat, ...pos } : seat;
  });
}

/** Önizlemede koridor: bu etikete sahip son koltuktan sonra böl (örn. "10" → 1–10 | koridor | 11+). */
function splitSeatsAfterSeatLabel(seats: Seat[], afterLabel: string): [Seat[], Seat[]] | null {
  const t = afterLabel.trim();
  if (!t) return null;
  const sorted = sortSeatsByLabel([...seats]);
  let idx = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (String(sorted[i].seat_label).trim() === t) idx = i;
  }
  if (idx < 0) return null;
  return [sorted.slice(0, idx + 1), sorted.slice(idx + 1)];
}

function getTicketColor(label: string): string {
  const key = (label || "").trim().toLowerCase();
  if (!key) return "bg-slate-300";
  if (key === "vip" || key === "vip bilet") return "bg-amber-500";
  if (key === "kategori 1") return "bg-rose-500";
  if (key === "kategori 2") return "bg-blue-500";
  if (key === "kategori 3") return "bg-emerald-500";
  if (key === "kategori 4") return "bg-cyan-500";
  if (key === "kategori 5") return "bg-fuchsia-500";
  if (key === "kategori 6") return "bg-lime-500";
  if (key === "kategori 7") return "bg-orange-500";
  if (key === "kategori 8") return "bg-violet-500";
  if (key === "kategori 9") return "bg-pink-500";
  if (key === "kategori 10") return "bg-teal-500";
  return "bg-slate-500";
}

function makeTempId(prefix: string): string {
  return `tmp_${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function OturumPlaniPage() {
  return (
    <OrganizerOrAdminGuard>
      <Suspense fallback={<div className="p-8 text-slate-500">Yükleniyor...</div>}>
        <OturumPlaniContent />
      </Suspense>
    </OrganizerOrAdminGuard>
  );
}

function OturumPlaniContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const venueId = params?.venueId as string;
  const rawReturn = searchParams.get("return");
  const safeReturn =
    rawReturn &&
    rawReturn.startsWith("/yonetim") &&
    !rawReturn.includes("//") &&
    rawReturn.startsWith("/")
      ? rawReturn
      : null;

  const [venueName, setVenueName] = useState<string>("");
  const [plans, setPlans] = useState<SeatingPlan[]>([]);
  const [sectionsByPlan, setSectionsByPlan] = useState<Record<string, SeatingPlanSection[]>>({});
  const [rowsBySection, setRowsBySection] = useState<Record<string, SeatingPlanRow[]>>({});
  const [seatsByRow, setSeatsByRow] = useState<Record<string, Seat[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [newPlanName, setNewPlanName] = useState("");
  const [addingPlan, setAddingPlan] = useState(false);
  const [addingMultipleSalons, setAddingMultipleSalons] = useState(false);
  const [musensaalCopyPlanName, setMusensaalCopyPlanName] = useState("Salon 1");
  const [newSectionName, setNewSectionName] = useState<Record<string, string>>({});
  const [newRowLabel, setNewRowLabel] = useState<Record<string, string>>({});
  const [newSeatRange, setNewSeatRange] = useState<Record<string, string>>({}); // "1-10" gibi
  const [sectionTicketLabel, setSectionTicketLabel] = useState<Record<string, string>>({}); // sectionId -> ticket_type_label (düzenleme)
  const [rowTicketLabelDraft, setRowTicketLabelDraft] = useState<Record<string, string>>({}); // rowId -> ticket_type_label
  const [rowRangeAssign, setRowRangeAssign] = useState<Record<string, { range: string; label: string }>>({}); // sectionId -> range+label
  const [bulkGridRows, setBulkGridRows] = useState<Record<string, string>>({});
  const [bulkGridSeats, setBulkGridSeats] = useState<Record<string, string>>({});
  const [categoryWizardText, setCategoryWizardText] = useState<Record<string, string>>({});
  const [sectionAlignDraft, setSectionAlignDraft] = useState<Record<string, "left" | "center" | "right">>({});
  const [saveFeedbackByPlan, setSaveFeedbackByPlan] = useState<
    Record<string, { type: "saving" | "ok" | "error"; message: string }>
  >({});
  /** Bu plana bağlı etkinliklerde iptal dışı siparişe girmiş koltuklar (çift satış / yanlış silmeyi önler). */
  const [soldSeatIdsByPlan, setSoldSeatIdsByPlan] = useState<Record<string, string[]>>({});
  const [copyingTemplate, setCopyingTemplate] = useState(false);
  const [creatingTheaterDuisburg, setCreatingTheaterDuisburg] = useState(false);
  const [addingMissingRows, setAddingMissingRows] = useState(false);
  const [addingMissingSeats, setAddingMissingSeats] = useState(false);
  const [salonPresetId, setSalonPresetId] = useState<SalonPresetId>("single_center");
  const [salonPresetRows, setSalonPresetRows] = useState(12);
  const [salonPresetSeats, setSalonPresetSeats] = useState(16);
  const [salonPresetSideRows, setSalonPresetSideRows] = useState(10);
  const [salonPresetSideSeats, setSalonPresetSideSeats] = useState(12);
  const [salonPresetFlank, setSalonPresetFlank] = useState<2 | 3 | 4>(3);
  const [salonPresetTicket, setSalonPresetTicket] = useState("");
  const [salonPresetCorridorMode, setSalonPresetCorridorMode] = useState<SalonPresetCorridorMode>("none");
  const [salonPresetCorridorAfterSeat, setSalonPresetCorridorAfterSeat] = useState("");
  const [newSectionCorridorMode, setNewSectionCorridorMode] = useState<
    Record<string, "none" | "horizontal" | "vertical">
  >({});
  const [newSectionCorridorAfterSeat, setNewSectionCorridorAfterSeat] = useState<Record<string, string>>({});

  const parseNumericRange = (value: string): { start: number; end: number } | null => {
    const m = value.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return { start: Math.min(a, b), end: Math.max(a, b) };
  };

  async function fetchSoldSeatIdsForPlanWithToken(planId: string, token: string): Promise<string[]> {
    const res = await fetch(
      `/api/yonetim/seating-plan-sold-seats?seating_plan_id=${encodeURIComponent(planId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const j = (await res.json()) as { seatIds?: string[] };
    return Array.isArray(j.seatIds) ? j.seatIds : [];
  }

  useEffect(() => {
    if (!venueId) return;
    (async () => {
      const { data: venue } = await supabase.from("venues").select("name").eq("id", venueId).single();
      setVenueName(venue?.name || "Mekan");

      const { data: plansData } = await supabase
        .from("seating_plans")
        .select("*")
        .eq("venue_id", venueId)
        .order("name");
      setPlans(plansData || []);

      if (plansData?.length) {
        const planIds = plansData.map((p) => p.id);
        const { data: sections } = await supabase
          .from("seating_plan_sections")
          .select("*")
          .in("seating_plan_id", planIds)
          .order("sort_order");
        const byPlan: Record<string, SeatingPlanSection[]> = {};
        (sections || []).forEach((s) => {
          if (!byPlan[s.seating_plan_id]) byPlan[s.seating_plan_id] = [];
          byPlan[s.seating_plan_id].push(s);
        });
        setSectionsByPlan(byPlan);

        const sectionIds = (sections || []).map((s) => s.id);
        if (sectionIds.length) {
          const { data: rows } = await supabase
            .from("seating_plan_rows")
            .select("*")
            .in("section_id", sectionIds)
            .order("sort_order");
          const bySection: Record<string, SeatingPlanRow[]> = {};
          (rows || []).forEach((r) => {
            if (!bySection[r.section_id]) bySection[r.section_id] = [];
            bySection[r.section_id].push(r);
          });
          setRowsBySection(bySection);

          const rowIds = (rows || []).map((r) => r.id);
          if (rowIds.length) {
            const seats = await fetchAllSeatsByRowIds<Seat>(supabase, rowIds, "*");
            const byRow: Record<string, Seat[]> = {};
            seats.forEach((s) => {
              if (!byRow[s.row_id]) byRow[s.row_id] = [];
              byRow[s.row_id].push(s);
            });
            setSeatsByRow(byRow);
          }
        }
      }

      if (plansData?.length) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const soldByPlan: Record<string, string[]> = {};
          await Promise.all(
            plansData.map(async (p) => {
              soldByPlan[p.id] = await fetchSoldSeatIdsForPlanWithToken(p.id, token);
            })
          );
          setSoldSeatIdsByPlan(soldByPlan);
        }
      }

      setLoading(false);
    })();
  }, [venueId]);

  const refreshPlans = async () => {
    if (!venueId) return;
    const { data } = await supabase.from("seating_plans").select("*").eq("venue_id", venueId).order("name");
    setPlans(data || []);
  };
  const refreshSections = async (planId: string) => {
    const { data } = await supabase
      .from("seating_plan_sections")
      .select("*")
      .eq("seating_plan_id", planId)
      .order("sort_order");
    setSectionsByPlan((prev) => ({ ...prev, [planId]: data || [] }));
  };
  const refreshRows = async (sectionId: string) => {
    const { data } = await supabase
      .from("seating_plan_rows")
      .select("*")
      .eq("section_id", sectionId)
      .order("sort_order");
    setRowsBySection((prev) => ({ ...prev, [sectionId]: data || [] }));
  };

  const normalizeRowsOrder = (sectionId: string, sourceRows?: SeatingPlanRow[]) => {
    const rows = sourceRows || rowsBySection[sectionId] || [];
    if (rows.length <= 1) return;

    const sorted = [...rows].sort((a, b) => {
      const aLabel = String(a.row_label || "").trim();
      const bLabel = String(b.row_label || "").trim();
      const na = Number(aLabel);
      const nb = Number(bLabel);
      const aNum = Number.isFinite(na);
      const bNum = Number.isFinite(nb);
      if (aNum && bNum) return na - nb;
      if (aNum && !bNum) return -1;
      if (!aNum && bNum) return 1;
      return aLabel.localeCompare(bLabel, undefined, { numeric: true, sensitivity: "base" });
    });

    setRowsBySection((prev) => ({
      ...prev,
      [sectionId]: sorted.map((row, i) => ({ ...row, sort_order: i })),
    }));
  };
  const refreshSeats = async (rowId: string) => {
    const { data } = await supabase.from("seats").select("*").eq("row_id", rowId);
    setSeatsByRow((prev) => ({ ...prev, [rowId]: data || [] }));
  };

  const autoNormalizeSeatPositionsIfUnedited = (rowId: string) => {
    const data = seatsByRow[rowId] || [];
    const aligned = alignSeatsToGridIfStillDefault(data);
    if (aligned === data) return;
    setSeatsByRow((prev) => ({ ...prev, [rowId]: aligned }));
  };

  const handleDeleteSeat = async (seatId: string, rowId: string, planId: string) => {
    const sold = new Set(soldSeatIdsByPlan[planId] ?? []);
    if (sold.has(seatId)) {
      alert("Bu koltuk iptal edilmemiş bir siparişe bağlı; silinemez.");
      return;
    }
    if (!confirm("Bu koltuk silinsin mi? Satılmış koltuk silinemez.")) return;
    setSeatsByRow((prev) => ({
      ...prev,
      [rowId]: (prev[rowId] || []).filter((s) => s.id !== seatId),
    }));
  };

  const handleDeleteRow = async (rowId: string, sectionId: string, planId: string) => {
    const sold = new Set(soldSeatIdsByPlan[planId] ?? []);
    const seats = seatsByRow[rowId] || [];
    if (seats.some((s) => sold.has(s.id))) {
      alert("Bu sırada iptal edilmemiş siparişe bağlı koltuk var; sıra silinemez.");
      return;
    }
    if (!confirm("Bu sıra ve içindeki tüm koltuklar silinsin mi? Sırada satılmış koltuk varsa sıra silinemez.")) return;
    setRowsBySection((prev) => ({
      ...prev,
      [sectionId]: (prev[sectionId] || [])
        .filter((r) => r.id !== rowId)
        .map((r, i) => ({ ...r, sort_order: i })),
    }));
    setSeatsByRow((prev) => {
      const next = { ...prev };
      delete next[rowId];
      return next;
    });
  };

  const handleAddPlan = async () => {
    if (!newPlanName.trim() || !venueId) return;
    setAddingPlan(true);
    const { data, error } = await supabase
      .from("seating_plans")
      .insert({ venue_id: venueId, name: newPlanName.trim(), is_default: plans.length === 0 })
      .select()
      .single();
    setAddingPlan(false);
    if (error) {
      alert("Salon eklenemedi: " + error.message);
      return;
    }
    setNewPlanName("");
    await refreshPlans();
    if (data) setExpandedPlan(data.id);
  };

  /** Bir seferde 2, 3 veya 4 salon ekler. Mevcut "Salon N" isimlerine bakıp numarayı devam ettirir (örn. 2 salon varsa Salon 3, Salon 4). */
  const handleAddMultipleSalons = async (count: number) => {
    if (!venueId || count < 2 || count > 4) return;
    const matchSalonN = plans.map((p) => p.name.match(/^Salon\s*(\d+)$/)).filter(Boolean) as RegExpMatchArray[];
    const maxN = matchSalonN.length ? Math.max(0, ...matchSalonN.map((m) => parseInt(m[1], 10))) : 0;
    const start = maxN + 1;
    setAddingMultipleSalons(true);
    try {
      for (let i = 0; i < count; i++) {
        const name = `Salon ${start + i}`;
        const isFirst = plans.length === 0 && i === 0;
        const { data, error } = await supabase
          .from("seating_plans")
          .insert({ venue_id: venueId, name, is_default: isFirst })
          .select()
          .single();
        if (error) {
          alert(`"${name}" eklenirken hata: ${error.message}`);
          break;
        }
        if (data && i === 0) setExpandedPlan(data.id);
      }
      await refreshPlans();
    } finally {
      setAddingMultipleSalons(false);
    }
  };

  const handleAddSection = async (planId: string) => {
    const name = newSectionName[planId]?.trim();
    if (!name) return;
    const sections = sectionsByPlan[planId] || [];
    const sectionId = makeTempId("section");
    const mode = newSectionCorridorMode[planId] ?? "none";
    const afterSeat =
      mode === "vertical" ? (newSectionCorridorAfterSeat[planId] ?? "").trim() || null : null;
    setSectionsByPlan((prev) => ({
      ...prev,
      [planId]: [
        ...sections,
        {
          id: sectionId,
          seating_plan_id: planId,
          name,
          sort_order: sections.length,
          ticket_type_label: null,
          corridor_mode: mode,
          corridor_gap_px: 0,
          corridor_after_seat_label: afterSeat,
          section_align: inferSectionAlignFromName(name),
        } as SeatingPlanSection,
      ],
    }));
    setNewSectionName((prev) => ({ ...prev, [planId]: "" }));
    setNewSectionCorridorMode((prev) => ({ ...prev, [planId]: "none" }));
    setNewSectionCorridorAfterSeat((prev) => ({ ...prev, [planId]: "" }));
  };

  const sectionNameGroup = (name: string) => {
    const n = String(name || "").toLowerCase();
    const side = n.includes("sağ") || n.includes("sag") || n.includes("right")
      ? "right"
      : n.includes("sol") || n.includes("left")
      ? "left"
      : "center";
    const base = n
      .replace(/\b(sağ|sag|right|sol|left)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { side, base };
  };

  const inferSectionAlignFromName = (sectionName: string): "left" | "center" | "right" => {
    const n = String(sectionName || "").toLowerCase();
    if (n.includes("sol") || n.includes("left")) return "left";
    if (n.includes("sağ") || n.includes("sag") || n.includes("right")) return "right";
    return "center";
  };

  const getSectionAlign = (
    sectionId: string,
    sectionName: string,
    persistedAlign?: "left" | "center" | "right" | null
  ): "left" | "center" | "right" => {
    const explicit = sectionAlignDraft[sectionId];
    if (explicit) return explicit;
    if (persistedAlign === "left" || persistedAlign === "center" || persistedAlign === "right") return persistedAlign;
    return inferSectionAlignFromName(sectionName);
  };

  const buildRowLabelsToInsert = (rows: SeatingPlanRow[], rawInput: string) => {
    let labelsToInsert: string[] = [];

    // "1-14" veya "1 - 14" ise toplu sıra ekle
    const range = parseNumericRange(rawInput);
    if (range) {
      for (let i = range.start; i <= range.end; i++) labelsToInsert.push(String(i));
    } else if (rawInput) {
      // Tek sıra etiketi (örn. A, B, 12)
      labelsToInsert = [rawInput];
    } else {
      // Input boşsa otomatik sayısal sırayı devam ettir (1, 2, 3...)
      const numericLabels = rows
        .map((r) => Number(String(r.row_label).trim()))
        .filter((n) => Number.isFinite(n));
      const nextNumber = numericLabels.length > 0 ? Math.max(...numericLabels) + 1 : 1;
      labelsToInsert = [String(nextNumber)];
    }

    const existingLabels = new Set(rows.map((r) => String(r.row_label).trim().toLowerCase()));
    labelsToInsert = labelsToInsert.filter((label) => !existingLabels.has(label.trim().toLowerCase()));
    return labelsToInsert;
  };

  const addRowsToSectionDraft = (sectionId: string, labelsToInsert: string[]) => {
    if (labelsToInsert.length === 0) return;
    const rows = rowsBySection[sectionId] || [];

    const payload = labelsToInsert.map((label, idx) => ({
      section_id: sectionId,
      row_label: label,
      sort_order: rows.length + idx,
    }));
    const nextRows = payload.map((p) => ({
      id: makeTempId("row"),
      section_id: p.section_id,
      row_label: p.row_label,
      sort_order: p.sort_order,
      ticket_type_label: null,
    })) as SeatingPlanRow[];
    const merged = [...rows, ...nextRows];
    setRowsBySection((prev) => ({ ...prev, [sectionId]: merged }));
    normalizeRowsOrder(sectionId, merged);
  };

  const handleAddRow = async (sectionId: string, planId: string) => {
    const rows = rowsBySection[sectionId] || [];
    const rawInput = (newRowLabel[sectionId] ?? "").trim();
    const labelsToInsert = buildRowLabelsToInsert(rows, rawInput);
    if (labelsToInsert.length === 0) {
      setNewRowLabel((prev) => ({ ...prev, [sectionId]: "" }));
      return;
    }
    addRowsToSectionDraft(sectionId, labelsToInsert);
    setNewRowLabel((prev) => ({ ...prev, [sectionId]: "" }));
  };

  /** Örn. 1–10 var, 3–7 eksikse aradaki sayıları sıra olarak ekler. (11–14 için alan kutusuna 11-14 yazın veya sonraki butonu kullanın.) */
  const handleFillMissingNumericRowsInSection = (sectionId: string) => {
    const rows = rowsBySection[sectionId] || [];
    const numeric = rows
      .map((r) => Number(String(r.row_label).trim()))
      .filter((n) => Number.isFinite(n));
    if (numeric.length === 0) {
      alert("Önce en az bir sayısal sıra etiketi (örn. 1, 2) ekleyin.");
      return;
    }
    const min = Math.min(...numeric);
    const max = Math.max(...numeric);
    const existing = new Set(rows.map((r) => String(r.row_label).trim().toLowerCase()));
    const labels: string[] = [];
    for (let i = min; i <= max; i++) {
      const L = String(i);
      if (!existing.has(L.toLowerCase())) labels.push(L);
    }
    if (labels.length === 0) {
      alert(`${min}–${max} aralığında eksik sıra numarası yok. Daha yüksek sıralar için kutuya örn. 11-14 yazıp «Sıra ekle» kullanın.`);
      return;
    }
    addRowsToSectionDraft(sectionId, labels);
  };

  const handleAddSeats = async (rowId: string, sectionId: string) => {
    const range = newSeatRange[rowId]?.trim();
    if (!range) return;
    const existing = seatsByRow[rowId] || [];
    const normalized = range.replace(/[–—]/g, "-");
    const labels: string[] = [];

    // 1-20 veya 1 - 20
    const rangeMatch = normalized.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) labels.push(String(i));
    } else {
      // Tekil veya çoklu giriş: "15" ya da "15,16,17"
      normalized
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((x) => labels.push(x));
    }

    const existingLabels = new Set(existing.map((s) => String(s.seat_label).trim().toLowerCase()));
    const uniqueLabels = Array.from(new Set(labels.map((l) => l.trim()).filter(Boolean)));
    const toInsert = uniqueLabels.filter((l) => !existingLabels.has(l.toLowerCase()));
    if (toInsert.length === 0) {
      setNewSeatRange((prev) => ({ ...prev, [rowId]: "" }));
      alert("Yeni koltuk bulunamadı. Bu numaralar zaten ekli olabilir.");
      return;
    }
    const toDraftSeats = toInsert.map((seat_label) => ({
      id: makeTempId("seat"),
      row_id: rowId,
      seat_label,
      sales_blocked: false,
    })) as Seat[];
    setSeatsByRow((prev) => ({ ...prev, [rowId]: [...existing, ...toDraftSeats] }));
    setNewSeatRange((prev) => ({ ...prev, [rowId]: "" }));
    autoNormalizeSeatPositionsIfUnedited(rowId);
  };

  /** Şablondan kopya oluşturur veya mevcut Musensaal planını şablonla yeniler. */
  const runMusensaalTemplate = async (planId: string, isNewPlan: boolean) => {
    const template = getMusensaalTemplateCopy();
    if (!isNewPlan) {
      const { data: existingSections } = await supabase.from("seating_plan_sections").select("id").eq("seating_plan_id", planId);
      const sectionIds = (existingSections || []).map((s) => s.id);
      if (sectionIds.length > 0) {
        const { data: rowsToDelete } = await supabase.from("seating_plan_rows").select("id").in("section_id", sectionIds);
        const rowIds = (rowsToDelete || []).map((r) => r.id);
        if (rowIds.length > 0) await supabase.from("seats").delete().in("row_id", rowIds);
        await supabase.from("seating_plan_rows").delete().in("section_id", sectionIds);
        await supabase.from("seating_plan_sections").delete().eq("seating_plan_id", planId);
      }
    }
    for (const section of template.sections) {
      const { data: sectionData, error: sectionErr } = await supabase
        .from("seating_plan_sections")
        .insert({
          seating_plan_id: planId,
          name: section.name,
          sort_order: section.sort_order,
          ticket_type_label: section.ticket_type_label ?? null,
        })
        .select()
        .single();
      if (sectionErr || !sectionData) {
        console.error("Section insert failed:", section.name, sectionErr);
        continue;
      }
      const sectionId = sectionData.id;
      for (let ri = 0; ri < section.rows.length; ri++) {
        const row = section.rows[ri];
        const { data: rowData, error: rowErr } = await supabase
          .from("seating_plan_rows")
          .insert({ section_id: sectionId, row_label: row.row_label, sort_order: row.sort_order })
          .select()
          .single();
        if (rowErr || !rowData) {
          console.error("Row insert failed:", section.name, row.row_label, rowErr);
          continue;
        }
        const toInsert = row.seat_labels.map((seat_label) => ({ row_id: rowData.id, seat_label }));
        for (let chunk = 0; chunk < toInsert.length; chunk += 50) {
          const batch = toInsert.slice(chunk, chunk + 50);
          const { error: seatErr } = await supabase.from("seats").insert(batch);
          if (seatErr) console.error("Seats insert failed:", section.name, row.row_label, seatErr);
        }
      }
    }
  };

  const handleCopyFromTemplate = async () => {
    if (!venueId) return;
    const planName = (musensaalCopyPlanName || "Salon 1").trim() || "Salon 1";
    if (!confirm(`Musensaal (Rosengarten Mannheim) şablonu bu mekana "${planName}" adıyla eklenecek. Onaylıyor musunuz?`)) return;
    setCopyingTemplate(true);
    try {
      const template = getMusensaalTemplateCopy();
      const { data: planData, error: planErr } = await supabase
        .from("seating_plans")
        .insert({ venue_id: venueId, name: planName, is_default: plans.length === 0 })
        .select()
        .single();
      if (planErr || !planData) {
        alert("Plan oluşturulamadı: " + (planErr?.message || "Bilinmeyen hata"));
        return;
      }
      await runMusensaalTemplate(planData.id, true);
      await refreshPlans();
      setExpandedPlan(planData.id);
    } finally {
      setCopyingTemplate(false);
    }
  };

  /** Theater Duisburg görsel planı için veritabanında bölüm/sıra/koltuk oluşturur (API ile). */
  const handleCreateTheaterDuisburg = async () => {
    if (!venueId) return;
    if (!confirm('Bu mekan için "Theater Duisburg" oturum planı oluşturulacak (bölümler, sıralar, koltuklar). Etkinlikte bu planı seçip görsel plan ile koltuk seçimi yapabilirsiniz. Devam?')) return;
    setCreatingTheaterDuisburg(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        alert('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }
      const res = await fetch('/api/yonetim/theater-duisburg-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ venueId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || 'Plan oluşturulamadı.');
        return;
      }
      await refreshPlans();
      if (data.planId) setExpandedPlan(data.planId);
    } finally {
      setCreatingTheaterDuisburg(false);
    }
  };

  /** Şablonda olup DB'de olmayan sıraları (ve koltuklarını) ekler. Mevcut veriler ve satılan koltuklar silinmez. */
  const handleAddMissingRows = async (planId: string) => {
    if (!confirm("Bu plan için Musensaal şablonundaki eksik sıralar eklenecek. Mevcut sıra ve koltuklar aynen kalır. Devam?")) return;
    setAddingMissingRows(true);
    try {
      const template = getMusensaalTemplateCopy();
      const { data: dbSections } = await supabase
        .from("seating_plan_sections")
        .select("id, name, sort_order")
        .eq("seating_plan_id", planId)
        .order("sort_order");
      if (!dbSections?.length || dbSections.length !== template.sections.length) {
        alert("Plan bölüm sayısı şablonla uyuşmuyor. Önce \"Şablonu yeniden uygula\" ile planı sıfırlayın.");
        return;
      }
      let added = 0;
      for (let si = 0; si < template.sections.length; si++) {
        const tSection = template.sections[si];
        const dbSection = dbSections[si];
        if (!dbSection || dbSection.name !== tSection.name) continue;
        const { data: existingRows } = await supabase
          .from("seating_plan_rows")
          .select("id, row_label")
          .eq("section_id", dbSection.id);
        const existingLabels = new Set((existingRows || []).map((r) => String(r.row_label).trim()));
        for (let ri = 0; ri < tSection.rows.length; ri++) {
          const tRow = tSection.rows[ri];
          const rowLabel = String(tRow.row_label).trim();
          if (existingLabels.has(rowLabel)) continue;
          const { data: rowData, error: rowErr } = await supabase
            .from("seating_plan_rows")
            .insert({ section_id: dbSection.id, row_label: rowLabel, sort_order: tRow.sort_order })
            .select()
            .single();
          if (rowErr || !rowData) {
            console.error("Row insert failed:", dbSection.name, rowLabel, rowErr);
            continue;
          }
          const toInsert = tRow.seat_labels.map((seat_label) => ({ row_id: rowData.id, seat_label }));
          for (let chunk = 0; chunk < toInsert.length; chunk += 50) {
            const batch = toInsert.slice(chunk, chunk + 50);
            const { error: seatErr } = await supabase.from("seats").insert(batch);
            if (seatErr) console.error("Seats insert failed:", dbSection.name, rowLabel, seatErr);
          }
          existingLabels.add(rowLabel);
          added++;
        }
      }
      if (added > 0) {
        await refreshPlans();
        const sectionIds = (dbSections || []).map((s) => s.id);
        const { data: rows } = await supabase.from("seating_plan_rows").select("*").in("section_id", sectionIds).order("sort_order");
        const bySection: Record<string, SeatingPlanRow[]> = {};
        (rows || []).forEach((r) => {
          if (!bySection[r.section_id]) bySection[r.section_id] = [];
          bySection[r.section_id].push(r);
        });
        setRowsBySection((prev) => ({ ...prev, ...bySection }));
        const rowIds = (rows || []).map((r) => r.id);
        if (rowIds?.length) {
          const seats = await fetchAllSeatsByRowIds<Seat>(supabase, rowIds, "*");
          const byRow: Record<string, Seat[]> = {};
          seats.forEach((s) => {
            if (!byRow[s.row_id]) byRow[s.row_id] = [];
            byRow[s.row_id].push(s);
          });
          setSeatsByRow((prev) => ({ ...prev, ...byRow }));
        }
        setExpandedPlan(planId);
        alert(`${added} eksik sıra eklendi.`);
      } else {
        alert("Eksik sıra bulunamadı; plan şablondaki tüm sıralara sahip.");
      }
    } finally {
      setAddingMissingRows(false);
    }
  };

  /** Koltukları olmayan (veya şablona göre eksik koltuklu) sıralara şablondan koltuk ekler. */
  const handleAddMissingSeats = async (planId: string) => {
    if (!confirm("Koltuk sayısı 0 olan sıralara Musensaal şablonundaki koltuk sayısı kadar koltuk eklenecek. Devam?")) return;
    setAddingMissingSeats(true);
    try {
      const template = getMusensaalTemplateCopy();
      const { data: dbSections } = await supabase
        .from("seating_plan_sections")
        .select("id, name, sort_order")
        .eq("seating_plan_id", planId)
        .order("sort_order");
      if (!dbSections?.length || dbSections.length !== template.sections.length) {
        alert("Plan bölüm sayısı şablonla uyuşmuyor.");
        return;
      }
      let rowsFilled = 0;
      let seatsAdded = 0;
      for (let si = 0; si < template.sections.length; si++) {
        const tSection = template.sections[si];
        const dbSection = dbSections[si];
        if (!dbSection || dbSection.name !== tSection.name) continue;
        const tRowByLabel = new Map(tSection.rows.map((r) => [String(r.row_label).trim(), r]));
        const { data: dbRows } = await supabase
          .from("seating_plan_rows")
          .select("id, row_label")
          .eq("section_id", dbSection.id);
        const existingSeats = await fetchAllSeatsByRowIds<{ row_id: string }>(
          supabase,
          (dbRows || []).map((r) => r.id),
          "row_id"
        );
        const seatCountByRowId = new Map<string, number>();
        existingSeats.forEach((s) => {
          seatCountByRowId.set(s.row_id, (seatCountByRowId.get(s.row_id) ?? 0) + 1);
        });
        for (const dbRow of dbRows || []) {
          const count = seatCountByRowId.get(dbRow.id) ?? 0;
          if (count > 0) continue;
          const rowLabel = String(dbRow.row_label).trim();
          const tRow = tRowByLabel.get(rowLabel);
          if (!tRow || !tRow.seat_labels.length) continue;
          const toInsert = tRow.seat_labels.map((seat_label) => ({ row_id: dbRow.id, seat_label }));
          for (let chunk = 0; chunk < toInsert.length; chunk += 50) {
            const batch = toInsert.slice(chunk, chunk + 50);
            const { error: seatErr } = await supabase.from("seats").insert(batch);
            if (seatErr) {
              console.error("Seats insert failed:", dbSection.name, rowLabel, seatErr);
              break;
            }
            seatsAdded += batch.length;
          }
          rowsFilled++;
        }
      }
      if (rowsFilled > 0 || seatsAdded > 0) {
        const sectionIds = dbSections.map((s) => s.id);
        const { data: rows } = await supabase.from("seating_plan_rows").select("*").in("section_id", sectionIds).order("sort_order");
        const bySection: Record<string, SeatingPlanRow[]> = {};
        (rows || []).forEach((r) => {
          if (!bySection[r.section_id]) bySection[r.section_id] = [];
          bySection[r.section_id].push(r);
        });
        setRowsBySection((prev) => ({ ...prev, ...bySection }));
        const rowIds = (rows || []).map((r) => r.id);
        if (rowIds?.length) {
          const seats = await fetchAllSeatsByRowIds<Seat>(supabase, rowIds, "*");
          const byRow: Record<string, Seat[]> = {};
          seats.forEach((s) => {
            if (!byRow[s.row_id]) byRow[s.row_id] = [];
            byRow[s.row_id].push(s);
          });
          setSeatsByRow((prev) => ({ ...prev, ...byRow }));
        }
        setExpandedPlan(planId);
        alert(`${rowsFilled} sıraya toplam ${seatsAdded} koltuk eklendi.`);
      } else {
        alert("Koltukları eksik sıra bulunamadı; tüm sıralarda koltuk var.");
      }
    } finally {
      setAddingMissingSeats(false);
    }
  };

  const handleResyncMusensaal = async (planId: string) => {
    if (!confirm("Bu planın tüm bölüm/sıra/koltuk verileri silinip Musensaal şablonu yeniden uygulanacak. Devam?")) return;
    setCopyingTemplate(true);
    try {
      await runMusensaalTemplate(planId, false);
      await refreshPlans();
      const { data: sections } = await supabase
        .from("seating_plan_sections")
        .select("*")
        .eq("seating_plan_id", planId)
        .order("sort_order");
      const byPlan: Record<string, SeatingPlanSection[]> = {};
      (sections || []).forEach((s) => {
        if (!byPlan[s.seating_plan_id]) byPlan[s.seating_plan_id] = [];
        byPlan[s.seating_plan_id].push(s);
      });
      setSectionsByPlan((prev) => ({ ...prev, ...byPlan }));
      const sectionIds = (sections || []).map((s) => s.id);
      if (sectionIds.length) {
        const { data: rows } = await supabase
          .from("seating_plan_rows")
          .select("*")
          .in("section_id", sectionIds)
          .order("sort_order");
        const bySection: Record<string, SeatingPlanRow[]> = {};
        (rows || []).forEach((r) => {
          if (!bySection[r.section_id]) bySection[r.section_id] = [];
          bySection[r.section_id].push(r);
        });
        setRowsBySection((prev) => ({ ...prev, ...bySection }));
        const rowIds = (rows || []).map((r) => r.id);
        if (rowIds.length) {
          const seats = await fetchAllSeatsByRowIds<Seat>(supabase, rowIds, "*");
          const byRow: Record<string, Seat[]> = {};
          seats.forEach((s) => {
            if (!byRow[s.row_id]) byRow[s.row_id] = [];
            byRow[s.row_id].push(s);
          });
          setSeatsByRow((prev) => ({ ...prev, ...byRow }));
        }
      }
      setExpandedPlan(planId);
    } finally {
      setCopyingTemplate(false);
    }
  };

  const setDefaultPlan = async (planId: string) => {
    await supabase.from("seating_plans").update({ is_default: false }).eq("venue_id", venueId);
    await supabase.from("seating_plans").update({ is_default: true }).eq("id", planId);
    await refreshPlans();
  };

  const deletePlan = async (planId: string) => {
    if (!confirm("Bu salonu ve tüm bölüm/sıra/koltuk verilerini silmek istediğinize emin misiniz?")) return;
    const { error } = await supabase.from("seating_plans").delete().eq("id", planId);
    if (error) alert("Silinemedi: " + error.message);
    else await refreshPlans();
  };

  const parseRange = (raw: string): { start: number; end: number } | null => {
    const m = raw.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) return null;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return { start: Math.min(a, b), end: Math.max(a, b) };
  };

  const applyRowRangeTicketLabel = async (sectionId: string) => {
    const cfg = rowRangeAssign[sectionId];
    if (!cfg) return;
    const range = parseRange(cfg.range || "");
    if (!range) {
      alert("Aralık biçimi geçersiz. Ornek: 2-4");
      return;
    }
    const label = (cfg.label || "").trim();
    if (!label) {
      alert("Kategori adı boş olamaz.");
      return;
    }

    const rows = rowsBySection[sectionId] || [];
    const targets = rows.filter((r) => {
      const n = Number(String(r.row_label).trim());
      return Number.isFinite(n) && n >= range.start && n <= range.end;
    });
    if (targets.length === 0) {
      alert("Bu aralıkta sayısal sıra bulunamadı.");
      return;
    }

    const targetIds = new Set(targets.map((r) => r.id));
    setRowsBySection((prev) => ({
      ...prev,
      [sectionId]: (prev[sectionId] || []).map((row) =>
        targetIds.has(row.id) ? { ...row, ticket_type_label: label } : row
      ),
    }));
    setRowRangeAssign((prev) => ({
      ...prev,
      [sectionId]: { range: prev[sectionId]?.range || "", label },
    }));
  };

  /** Örn. sıra 1–100, her sırada koltuk 1–25 tek seferde (mevcut sıra/koltuklara dokunmadan eksikleri tamamlar). */
  const bulkFillNumericGrid = (sectionId: string) => {
    const rawRows = (bulkGridRows[sectionId] ?? "").trim();
    const rawSeats = (bulkGridSeats[sectionId] ?? "").trim();
    const rowR = parseNumericRange(rawRows);
    const seatR = parseNumericRange(rawSeats);
    if (!rowR || !seatR) {
      alert("Sıra ve koltuk alanları aralık olmalı (örn. 1-100 ve 1-25).");
      return;
    }
    const curRows = [...(rowsBySection[sectionId] || [])];
    const byLabel = new Map(curRows.map((r) => [String(r.row_label).trim().toLowerCase(), r]));
    for (let n = rowR.start; n <= rowR.end; n++) {
      const lb = String(n);
      const key = lb.toLowerCase();
      if (!byLabel.has(key)) {
        const nr = {
          id: makeTempId("row"),
          section_id: sectionId,
          row_label: lb,
          sort_order: curRows.length,
          ticket_type_label: null,
        } as SeatingPlanRow;
        curRows.push(nr);
        byLabel.set(key, nr);
      }
    }
    const sorted = [...curRows].sort((a, b) => {
      const aLabel = String(a.row_label || "").trim();
      const bLabel = String(b.row_label || "").trim();
      const na = Number(aLabel);
      const nb = Number(bLabel);
      const aNum = Number.isFinite(na);
      const bNum = Number.isFinite(nb);
      if (aNum && bNum) return na - nb;
      if (aNum && !bNum) return -1;
      if (!aNum && bNum) return 1;
      return aLabel.localeCompare(bLabel, undefined, { numeric: true, sensitivity: "base" });
    });
    const reindexed = sorted.map((row, i) => ({ ...row, sort_order: i }));
    setRowsBySection((prev) => ({ ...prev, [sectionId]: reindexed }));

    const seatLabels: string[] = [];
    for (let s = seatR.start; s <= seatR.end; s++) seatLabels.push(String(s));

    setSeatsByRow((prev) => {
      const next = { ...prev };
      for (const row of reindexed) {
        const rn = Number(String(row.row_label).trim());
        if (!Number.isFinite(rn) || rn < rowR.start || rn > rowR.end) continue;
        const existing = next[row.id] || [];
        const existingLbl = new Set(existing.map((x) => String(x.seat_label).trim().toLowerCase()));
        const toAdd = seatLabels
          .filter((l) => !existingLbl.has(l.toLowerCase()))
          .map(
            (seat_label) =>
              ({
                id: makeTempId("seat"),
                row_id: row.id,
                seat_label,
                sales_blocked: false,
              }) as Seat
          );
        if (toAdd.length === 0) continue;
        const merged = alignSeatsToGridIfStillDefault([...existing, ...toAdd]);
        next[row.id] = merged;
      }
      return next;
    });
  };

  /**
   * Çok satırlı kategori kuralları (aşağıdan yukarı öncelik yoksa son eşleşen kazanır):
   *   1-5 VIP
   *   6-10 Kategori 1
   */
  const applyCategoryWizardLines = (sectionId: string) => {
    const text = categoryWizardText[sectionId] ?? "";
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#"));
    const rowLine = /^(\d+)\s*-\s*(\d+)\s+(.+)$/;
    const rules: { start: number; end: number; label: string }[] = [];
    const bad: string[] = [];
    for (const line of lines) {
      const m = line.match(rowLine);
      if (!m) {
        bad.push(line);
        continue;
      }
      const a = Number(m[1]);
      const b = Number(m[2]);
      const label = (m[3] || "").trim();
      if (!Number.isFinite(a) || !Number.isFinite(b) || !label) {
        bad.push(line);
        continue;
      }
      rules.push({ start: Math.min(a, b), end: Math.max(a, b), label });
    }
    if (rules.length === 0) {
      alert("En az bir geçerli satır girin (örn. 1-5 VIP).");
      if (bad.length) alert("Okunamayan satırlar:\n" + bad.join("\n"));
      return;
    }
    setRowsBySection((prev) => {
      const cur = [...(prev[sectionId] || [])];
      const nextRows = cur.map((row) => {
        const n = Number(String(row.row_label).trim());
        if (!Number.isFinite(n)) return row;
        let label: string | undefined;
        for (const rule of rules) {
          if (n >= rule.start && n <= rule.end) label = rule.label;
        }
        if (label === undefined) return row;
        return { ...row, ticket_type_label: label };
      });
      return { ...prev, [sectionId]: nextRows };
    });
    if (bad.length) alert("Okunamayan satırlar:\n" + bad.join("\n"));
  };

  const handleSavePlan = async (planId: string) => {
    const draftSections = sectionsByPlan[planId] || [];
    try {
      setSaveFeedbackByPlan((prev) => ({
        ...prev,
        [planId]: { type: "saving", message: "Salon kaydediliyor..." },
      }));
      const fail = (message: string) => {
        setSaveFeedbackByPlan((prev) => ({
          ...prev,
          [planId]: { type: "error", message },
        }));
        alert(message);
      };

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? "";
      let soldIds = soldSeatIdsByPlan[planId] ?? [];
      if (token) {
        soldIds = await fetchSoldSeatIdsForPlanWithToken(planId, token);
        setSoldSeatIdsByPlan((prev) => ({ ...prev, [planId]: soldIds }));
      }
      const soldSet = new Set(soldIds);

      const sectionIdMap = new Map<string, string>();

      const { data: dbSections, error: dbSectionsError } = await supabase
        .from("seating_plan_sections")
        .select("id")
        .eq("seating_plan_id", planId);
      if (dbSectionsError) {
        fail("Salon kaydedilemedi: " + dbSectionsError.message);
        return;
      }

      const keptSectionIds = new Set(
        draftSections.filter((s) => !s.id.startsWith("tmp_")).map((s) => s.id)
      );
      const sectionsToDelete = (dbSections || [])
        .map((s) => s.id)
        .filter((id) => !keptSectionIds.has(id));
      if (sectionsToDelete.length) {
        const { data: rowsInRemovedSections } = await supabase
          .from("seating_plan_rows")
          .select("id")
          .in("section_id", sectionsToDelete);
        const rids = (rowsInRemovedSections || []).map((r) => r.id);
        if (rids.length) {
          const { data: seatsTouch } = await supabase.from("seats").select("id").in("row_id", rids);
          if ((seatsTouch || []).some((s) => soldSet.has(s.id))) {
            fail("Satılmış koltuk bulunan bölüm silinemez. İptal edilmemiş siparişlerdeki koltukları koruyun.");
            return;
          }
        }
        const { error } = await supabase
          .from("seating_plan_sections")
          .delete()
          .in("id", sectionsToDelete);
        if (error) {
          fail("Salon kaydedilemedi: " + error.message);
          return;
        }
      }

      for (let si = 0; si < draftSections.length; si++) {
        const section = draftSections[si];
        const draftValue = sectionTicketLabel[section.id];
        const ticketTypeLabel =
          draftValue !== undefined
            ? draftValue.trim() || null
            : (section as SeatingPlanSection & { ticket_type_label?: string }).ticket_type_label ?? null;

        const corridorMode = section.corridor_mode ?? "none";
        const corridorAfterSeat =
          corridorMode === "vertical"
            ? (section.corridor_after_seat_label ?? "").trim() || null
            : null;
        const sectionAlign = getSectionAlign(section.id, section.name, section.section_align ?? null);

        if (section.id.startsWith("tmp_")) {
          const { data, error } = await supabase
            .from("seating_plan_sections")
            .insert({
              seating_plan_id: planId,
              name: section.name,
              sort_order: si,
              ticket_type_label: ticketTypeLabel,
              corridor_mode: corridorMode,
              corridor_gap_px: 0,
              corridor_after_seat_label: corridorAfterSeat,
              section_align: sectionAlign,
            })
            .select("id")
            .single();
          if (error) {
            fail("Salon kaydedilemedi: " + error.message);
            return;
          }
          sectionIdMap.set(section.id, data.id);
        } else {
          const { error } = await supabase
            .from("seating_plan_sections")
            .update({
              name: section.name,
              sort_order: si,
              ticket_type_label: ticketTypeLabel,
              corridor_mode: corridorMode,
              corridor_gap_px: 0,
              corridor_after_seat_label: corridorAfterSeat,
              section_align: sectionAlign,
            })
            .eq("id", section.id);
          if (error) {
            fail("Salon kaydedilemedi: " + error.message);
            return;
          }
          sectionIdMap.set(section.id, section.id);
        }
      }

      for (const section of draftSections) {
        const mappedSectionId = sectionIdMap.get(section.id);
        if (!mappedSectionId) continue;
        const draftRows = rowsBySection[section.id] || [];

        const { data: dbRows, error: dbRowsError } = await supabase
          .from("seating_plan_rows")
          .select("id")
          .eq("section_id", mappedSectionId);
        if (dbRowsError) {
          fail("Salon kaydedilemedi: " + dbRowsError.message);
          return;
        }

        const keptRowIds = new Set(draftRows.filter((r) => !r.id.startsWith("tmp_")).map((r) => r.id));
        const rowsToDelete = (dbRows || []).map((r) => r.id).filter((id) => !keptRowIds.has(id));
        if (rowsToDelete.length) {
          const { data: seatsInDeletedRows } = await supabase.from("seats").select("id").in("row_id", rowsToDelete);
          if ((seatsInDeletedRows || []).some((s) => soldSet.has(s.id))) {
            fail("Satılmış koltuk içeren sıra silinemez. İptal edilmemiş siparişlerdeki sıraları koruyun.");
            return;
          }
          const { error } = await supabase.from("seating_plan_rows").delete().in("id", rowsToDelete);
          if (error) {
            fail("Salon kaydedilemedi: " + error.message);
            return;
          }
        }

        const rowIdMap = new Map<string, string>();
        for (let ri = 0; ri < draftRows.length; ri++) {
          const row = draftRows[ri];
          const rowDraft = rowTicketLabelDraft[row.id];
          const rowTicketTypeLabel = rowDraft !== undefined ? rowDraft.trim() || null : row.ticket_type_label ?? null;

          if (row.id.startsWith("tmp_")) {
            const { data, error } = await supabase
              .from("seating_plan_rows")
              .insert({
                section_id: mappedSectionId,
                row_label: row.row_label,
                sort_order: ri,
                ticket_type_label: rowTicketTypeLabel,
              })
              .select("id")
              .single();
            if (error) {
              fail("Salon kaydedilemedi: " + error.message);
              return;
            }
            rowIdMap.set(row.id, data.id);
          } else {
            const { error } = await supabase
              .from("seating_plan_rows")
              .update({
                section_id: mappedSectionId,
                row_label: row.row_label,
                sort_order: ri,
                ticket_type_label: rowTicketTypeLabel,
              })
              .eq("id", row.id);
            if (error) {
              fail("Salon kaydedilemedi: " + error.message);
              return;
            }
            rowIdMap.set(row.id, row.id);
          }
        }

        for (let ri = 0; ri < draftRows.length; ri++) {
          const row = draftRows[ri];
          const mappedRowId = rowIdMap.get(row.id);
          if (!mappedRowId) {
            fail(`Salon kaydedilemedi: "${row.row_label}" sırası için eşleme bulunamadı. Sayfayı yenileyip tekrar deneyin.`);
            return;
          }
          const draftSeats = seatsByRow[row.id] || [];
          const { data: dbSeats, error: dbSeatsError } = await supabase
            .from("seats")
            .select("id, seat_label")
            .eq("row_id", mappedRowId);
          if (dbSeatsError) {
            fail("Salon kaydedilemedi: " + dbSeatsError.message);
            return;
          }

          // Aynı satırda aynı seat_label tek olmalı; kaydetmede etiket bazlı senkron yap.
          const normalizeSeatLabel = (v: string) => String(v || "").trim().toLowerCase();
          const draftByLabel = new Map<string, Seat>();
          for (const seat of draftSeats) {
            const key = normalizeSeatLabel(seat.seat_label);
            if (!key) continue;
            const prev = draftByLabel.get(key);
            // Aynı etiket hem tmp hem kalıcı id ile varsa kalıcı kaydı tercih et.
            if (!prev || (prev.id.startsWith("tmp_") && !seat.id.startsWith("tmp_"))) {
              draftByLabel.set(key, seat);
            }
          }

          const dbByLabel = new Map<string, { id: string; seat_label: string }>();
          for (const s of dbSeats || []) {
            dbByLabel.set(normalizeSeatLabel(s.seat_label), s);
          }

          const seatsToDelete = (dbSeats || [])
            .filter((s) => !draftByLabel.has(normalizeSeatLabel(s.seat_label)))
            .map((s) => s.id);
          const blockedSeatDelete = seatsToDelete.filter((id) => soldSet.has(id));
          if (blockedSeatDelete.length) {
            fail(
              `İptal edilmemiş siparişe bağlı ${blockedSeatDelete.length} koltuk taslaktan kaldırılamaz (satılmış koltuklar korunmalı).`
            );
            return;
          }
          if (seatsToDelete.length) {
            const { error } = await supabase.from("seats").delete().in("id", seatsToDelete);
            if (error) {
              fail("Salon kaydedilemedi: " + error.message);
              return;
            }
          }

          for (const [key, seat] of draftByLabel.entries()) {
            const payload = {
              row_id: mappedRowId,
              seat_label: String(seat.seat_label).trim(),
              x: seat.x ?? null,
              y: seat.y ?? null,
              sales_blocked: seat.sales_blocked === true,
            };
            const existingSeat = dbByLabel.get(key);
            if (existingSeat) {
              const { row_id: _ignored, ...updatePayload } = payload;
              const { error } = await supabase.from("seats").update(updatePayload).eq("id", existingSeat.id);
              if (error) {
                fail("Salon kaydedilemedi: " + error.message);
                return;
              }
            } else {
              const { error } = await supabase.from("seats").insert(payload);
              if (error) {
                fail("Salon kaydedilemedi: " + error.message);
                return;
              }
            }
          }
        }
      }

      await refreshSections(planId);
      const { data: sectionsAfter } = await supabase
        .from("seating_plan_sections")
        .select("*")
        .eq("seating_plan_id", planId)
        .order("sort_order");
      const nextSections = sectionsAfter || [];
      setSectionsByPlan((prev) => ({ ...prev, [planId]: nextSections }));

      const sectionIds = nextSections.map((s) => s.id);
      if (sectionIds.length) {
        const { data: rowsAfter } = await supabase
          .from("seating_plan_rows")
          .select("*")
          .in("section_id", sectionIds)
          .order("sort_order");
        const nextRowsBySection: Record<string, SeatingPlanRow[]> = {};
        (rowsAfter || []).forEach((r) => {
          if (!nextRowsBySection[r.section_id]) nextRowsBySection[r.section_id] = [];
          nextRowsBySection[r.section_id].push(r);
        });
        setRowsBySection((prev) => ({ ...prev, ...nextRowsBySection }));

        const rowIds = (rowsAfter || []).map((r) => r.id);
        if (rowIds.length) {
          const seatsAfter = await fetchAllSeatsByRowIds<Seat>(supabase, rowIds, "*");
          const nextSeatsByRow: Record<string, Seat[]> = {};
          seatsAfter.forEach((s) => {
            if (!nextSeatsByRow[s.row_id]) nextSeatsByRow[s.row_id] = [];
            nextSeatsByRow[s.row_id].push(s);
          });
          setSeatsByRow((prev) => ({ ...prev, ...nextSeatsByRow }));
        }
      }

      setSaveFeedbackByPlan((prev) => ({
        ...prev,
        [planId]: { type: "ok", message: "Salon başarıyla kaydedildi." },
      }));
      alert("Salon başarıyla kaydedildi.");
    } catch (e) {
      setSaveFeedbackByPlan((prev) => ({
        ...prev,
        [planId]: { type: "error", message: "Salon kaydedilemedi." },
      }));
      alert("Salon kaydedilemedi.");
      console.error(e);
    }
  };

  const handleDeleteSection = async (sectionId: string, planId: string, sectionName: string) => {
    const sold = new Set(soldSeatIdsByPlan[planId] ?? []);
    const sectionRows = rowsBySection[sectionId] || [];
    for (const row of sectionRows) {
      const seats = seatsByRow[row.id] || [];
      if (seats.some((s) => sold.has(s.id))) {
        alert(`"${sectionName}" bölümünde iptal edilmemiş siparişe bağlı koltuk var; bölüm silinemez.`);
        return;
      }
    }
    if (!confirm(`"${sectionName}" bölümü silinsin mi? Bu bölümdeki tüm sıra/koltuklar da silinir.`)) return;
    setSectionsByPlan((prev) => ({
      ...prev,
      [planId]: (prev[planId] || [])
        .filter((s) => s.id !== sectionId)
        .map((s, i) => ({ ...s, sort_order: i })),
    }));
    setRowsBySection((prev) => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
    setSeatsByRow((prev) => {
      const next = { ...prev };
      for (const row of sectionRows) delete next[row.id];
      return next;
    });
    setExpandedSection((cur) => (cur === sectionId ? null : cur));
  };

  const handleApplySalonLayoutPreset = (planId: string) => {
    const existing = sectionsByPlan[planId] || [];
    if (existing.length > 0) {
      const ok = window.confirm(
        "Bu salondaki mevcut taslak bölüm, sıra ve koltuklar silinip seçilen şablon uygulanacak. Devam edilsin mi?"
      );
      if (!ok) return;
    }
    const oldSectionIds = existing.map((s) => s.id);
    const oldRowIds: string[] = [];
    for (const sid of oldSectionIds) {
      for (const r of rowsBySection[sid] || []) oldRowIds.push(r.id);
    }
    const draft = buildSalonPresetDraft(planId, salonPresetId, {
      rowCount: salonPresetRows,
      seatsPerRow: salonPresetSeats,
      sideRowCount: salonPresetSideRows,
      sideSeatsPerRow: salonPresetSideSeats,
      flankSegmentsPerSide: salonPresetFlank,
      defaultTicketLabel: salonPresetTicket.trim() || null,
      corridorMode: salonPresetCorridorMode,
      corridorAfterSeatLabel:
        salonPresetCorridorMode === "vertical" ? salonPresetCorridorAfterSeat.trim() || null : null,
    });
    setSectionsByPlan((prev) => ({ ...prev, [planId]: draft.sections }));
    setRowsBySection((prev) => {
      const next = { ...prev };
      for (const sid of oldSectionIds) delete next[sid];
      for (const sid of Object.keys(draft.rowsBySection)) {
        next[sid] = draft.rowsBySection[sid];
      }
      return next;
    });
    setSeatsByRow((prev) => {
      const next = { ...prev };
      for (const rid of oldRowIds) delete next[rid];
      Object.assign(next, draft.seatsByRow);
      return next;
    });
    setSectionTicketLabel((prev) => {
      const next = { ...prev };
      for (const sid of oldSectionIds) delete next[sid];
      return next;
    });
    setRowTicketLabelDraft((prev) => {
      const next = { ...prev };
      for (const rid of oldRowIds) delete next[rid];
      return next;
    });
    setSectionAlignDraft((prev) => {
      const next = { ...prev };
      for (const sid of oldSectionIds) delete next[sid];
      return next;
    });
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="p-8 w-full max-w-[1600px] mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/yonetim/mekanlar"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Mekanlar
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Salon tasarımı</h1>
      {safeReturn && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-slate-800">
          <span>Etkinlik sihirbazından geldiniz. Planı kaydettikten sonra geri dönüp salonu seçebilirsiniz.</span>
          <Link
            href={safeReturn}
            className="shrink-0 rounded-md bg-primary-600 px-3 py-1.5 text-white text-sm font-medium hover:bg-primary-700"
          >
            Etkinlik sihirbazına dön
          </Link>
        </div>
      )}
      <p className="mt-1 text-slate-600">
        <strong>{venueName}</strong> için salonları burada tanımlayın. Salonda <strong>Hızlı salon şablonu</strong> ile tek/çift parket, yan şeritler ve Musensaal tarzı çoklu yan blokları saniyeler içinde oluşturabilirsiniz. Musensaal (Rosengarten Mannheim) ayrıntılı planını kullanmak için aşağıdan şablondan kopyalayın; açtığınız salonda görsel koltuk planı önizlemesi gösterilir. Etkinlik oluştururken mekan + salon seçilir. Her sıra altında <strong>sürükle-bırak</strong> ile koltuk konumlarını kaydedebilirsiniz.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Blok taslağı ile tasarlamak isterseniz: <Link href="/yonetim/salon-tasarim-vizor" className="text-primary-600 hover:underline">Salon Tasarım Vizörü</Link> ile tasarlayıp &quot;Bu planı mekana aktar&quot; ile bu mekana ekleyebilirsiniz.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={newPlanName}
          onChange={(e) => setNewPlanName(e.target.value)}
          placeholder="Salon adı (örn. Salon 1, Ana salon)"
          className="rounded-lg border border-slate-300 px-3 py-2 flex-1 max-w-xs"
        />
        <button
          type="button"
          onClick={handleAddPlan}
          disabled={addingPlan || !newPlanName.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Yeni salon
        </button>
        <span className="text-slate-400 text-sm">veya</span>
        <div className="inline-flex gap-1">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleAddMultipleSalons(n)}
              disabled={addingMultipleSalons}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-sm"
              title={`${n} salon ekle (Salon 1 … Salon ${n})`}
            >
              {addingMultipleSalons ? "Ekleniyor…" : `${n} salon ekle`}
            </button>
          ))}
        </div>
        <span className="text-slate-500 text-sm">Musensaal şablonu:</span>
        <input
          type="text"
          value={musensaalCopyPlanName}
          onChange={(e) => setMusensaalCopyPlanName(e.target.value)}
          placeholder="Salon 1 veya Musensaal"
          className="rounded-lg border border-slate-300 px-3 py-2 w-40"
          title="Şablon kopyalandığında bu isimle salon oluşturulur"
        />
        <button
          type="button"
          onClick={handleCopyFromTemplate}
          disabled={copyingTemplate}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          title="Musensaal (Rosengarten Mannheim) koltuk planı bu mekana verilen isimle eklenir."
        >
          <Copy className="h-4 w-4" />
          {copyingTemplate ? "Kopyalanıyor…" : "Şablondan kopyala: Musensaal"}
        </button>
        <button
          type="button"
          onClick={handleCreateTheaterDuisburg}
          disabled={creatingTheaterDuisburg}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          title="Theater Duisburg (görsel plan) bölüm/sıra/koltuk verilerini veritabanında oluşturur. Etkinlikte bu planı seçince salon görseli üzerinde tıklanabilir koltuklar gösterilir."
        >
          <Copy className="h-4 w-4" />
          {creatingTheaterDuisburg ? "Oluşturuluyor…" : "Theater Duisburg planını oluştur"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        <strong>Musensaal:</strong> &quot;Salon 1&quot; veya &quot;Musensaal&quot; yazıp &quot;Şablondan kopyala&quot; ile Rosengarten Mannheim koltuk planı bu mekana eklenir. <strong>Theater Duisburg:</strong> &quot;Theater Duisburg planını oluştur&quot; ile görsel plan (fotoğraf/PDF) ile eşleşen bölüm/sıra/koltuk veritabanına eklenir; <code>public/seatplans/theaterduisburg.svg</code> dosyası varken etkinlik sayfasında görsel plan gösterilir; koltuk id’leri için <code>npm run seatplan:tag-duisburg</code> ile <code>theaterduisburg.tagged.svg</code> üretilebilir.
      </p>
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Bilet türleri ile eşleştirme:</strong> Her bölümde &quot;Bilet türü (etkinlikte eşlenecek)&quot; alanına yazdığınız isim, <em>etkinlik oluştururken</em> eklediğiniz bilet türü adıyla <strong>birebir aynı</strong> olmalı (örn. Kategori 1, Kategori 2). Musensaal şablonundan kopyaladıysanız bölümler zaten Kategori 1–4 ile işaretlidir; etkinlikte bu isimlerle bilet türü ekleyin.
      </div>

      <div className="mt-8 space-y-4">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setExpandedPlan((id) => (id === plan.id ? null : plan.id))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedPlan((id) => (id === plan.id ? null : plan.id));
                }
              }}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 cursor-pointer"
            >
              <span className="flex items-center gap-2 font-semibold text-slate-900">
                {expandedPlan === plan.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {plan.name}
                {plan.is_default && <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">Varsayılan</span>}
              </span>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {plan.name && plan.name.includes("Musensaal") && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAddMissingRows(plan.id)}
                      disabled={copyingTemplate || addingMissingRows || addingMissingSeats}
                      className="text-sm text-green-700 hover:text-green-800 border border-green-400 px-2 py-1 rounded"
                      title="Şablonda olup planda olmayan sıraları ekler. Mevcut veriler silinmez."
                    >
                      {addingMissingRows ? "Ekleniyor…" : "Eksik sıraları ekle"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddMissingSeats(plan.id)}
                      disabled={copyingTemplate || addingMissingRows || addingMissingSeats}
                      className="text-sm text-blue-700 hover:text-blue-800 border border-blue-400 px-2 py-1 rounded"
                      title="Koltuk sayısı 0 olan sıralara şablondan koltuk ekler."
                    >
                      {addingMissingSeats ? "Ekleniyor…" : "Eksik koltukları ekle"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResyncMusensaal(plan.id)}
                      disabled={copyingTemplate || addingMissingRows || addingMissingSeats}
                      className="text-sm text-amber-700 hover:text-amber-800 border border-amber-300 px-2 py-1 rounded"
                      title="Bölüm/sıra/koltuk verilerini siler ve güncel Musensaal şablonunu yeniden uygular (Parkett 1–29, Empore Hinten 5–12 vb.)."
                    >
                      Şablonu yeniden uygula
                    </button>
                  </>
                )}
                {!plan.is_default && (
                  <button
                    type="button"
                    onClick={() => setDefaultPlan(plan.id)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    Varsayılan yap
                  </button>
                )}
                <button type="button" onClick={() => deletePlan(plan.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Planı sil">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {expandedPlan === plan.id && (
              <div className="border-t border-slate-200 px-5 pb-5 pt-2">
                <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">Hızlı salon şablonu</h3>
                  <p className="text-xs text-slate-600 mb-3">
                    Adlandırılmış düzenlerle bölüm ve sıraları otomatik oluşturun; konumu düzenlemek için aşağıdaki sürükle-bırak alanını kullanın. Koridor seçerseniz{" "}
                    <strong>şablondan oluşan her bölüme</strong> aynı ayar uygulanır (sonradan bölüm başına değiştirebilirsiniz). Veritabanına yazmak için{" "}
                    <strong>Salonu Kaydet</strong> gerekir.
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 text-xs text-slate-600 min-w-[220px] flex-1">
                      Şablon
                      <select
                        value={salonPresetId}
                        onChange={(e) => setSalonPresetId(e.target.value as SalonPresetId)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                      >
                        {SALON_PRESET_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-600 w-24">
                      Sıra
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={salonPresetRows}
                        onChange={(e) => setSalonPresetRows(Number(e.target.value) || 1)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-600 w-24">
                      Koltuk
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={salonPresetSeats}
                        onChange={(e) => setSalonPresetSeats(Number(e.target.value) || 1)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </label>
                    {presetUsesSideDimensions(salonPresetId) && (
                      <>
                        <label className="flex flex-col gap-1 text-xs text-slate-600 w-24">
                          Yan sıra
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={salonPresetSideRows}
                            onChange={(e) => setSalonPresetSideRows(Number(e.target.value) || 1)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-slate-600 w-24">
                          Yan koltuk
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={salonPresetSideSeats}
                            onChange={(e) => setSalonPresetSideSeats(Number(e.target.value) || 1)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                          />
                        </label>
                      </>
                    )}
                    {presetUsesFlankCount(salonPresetId) && (
                      <label className="flex flex-col gap-1 text-xs text-slate-600 w-28">
                        Yan şerit
                        <select
                          value={salonPresetFlank}
                          onChange={(e) => setSalonPresetFlank(Number(e.target.value) as 2 | 3 | 4)}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        >
                          <option value={2}>2 / yan</option>
                          <option value={3}>3 / yan</option>
                          <option value={4}>4 / yan</option>
                        </select>
                      </label>
                    )}
                    <div className="flex flex-col gap-1 text-xs text-slate-600 min-w-[200px] flex-1 max-w-md">
                      <span>Varsayılan bilet türü (opsiyonel)</span>
                      <TicketTypeLabelSelect
                        value={salonPresetTicket}
                        onChange={setSalonPresetTicket}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm w-full max-w-sm"
                      />
                    </div>
                    <label className="flex flex-col gap-1 text-xs text-slate-600 w-44">
                      Koridor (tüm bölümler)
                      <select
                        value={salonPresetCorridorMode}
                        onChange={(e) => setSalonPresetCorridorMode(e.target.value as SalonPresetCorridorMode)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        title="Yatay: bölüm kartları arası boşluk. Dikey: her sırayı yazdığınız koltuktan sonra böler."
                      >
                        <option value="none">Yok</option>
                        <option value="horizontal">Yatay (bloklar arası)</option>
                        <option value="vertical">Dikey (koltuktan sonra)</option>
                      </select>
                    </label>
                    {salonPresetCorridorMode === "vertical" && (
                      <label className="flex flex-col gap-1 text-xs text-slate-600 w-28">
                        Koltuk no
                        <input
                          type="text"
                          inputMode="numeric"
                          value={salonPresetCorridorAfterSeat}
                          onChange={(e) => setSalonPresetCorridorAfterSeat(e.target.value)}
                          placeholder="örn. 10"
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => handleApplySalonLayoutPreset(plan.id)}
                      className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                    >
                      Şablonu uygula
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {SALON_PRESET_OPTIONS.find((x) => x.id === salonPresetId)?.description}
                    {salonPresetCorridorMode !== "none" && (
                      <>
                        {" "}
                        <span className="text-slate-600">
                          Koridor:{" "}
                          {salonPresetCorridorMode === "horizontal"
                            ? "yatay (her bölüm altında boşluk)"
                            : `dikey (koltuk ${salonPresetCorridorAfterSeat.trim() || "…"} sonrası)`}
                          .
                        </span>
                      </>
                    )}
                  </p>
                </div>
                {planHasMusensaalStructure(sectionsByPlan[plan.id] || []) && (() => {
                  const musensaalPlan = getPlan("musensaal");
                  return musensaalPlan ? (
                    <div className="mb-6 rounded-xl border border-primary-200 bg-white p-4">
                      <h3 className="text-sm font-semibold text-slate-800 mb-2">Koltuk planı önizleme (Musensaal düzeni)</h3>
                      <p className="text-xs text-slate-500 mb-3">Bu salon Musensaal (Rosengarten Mannheim) düzenindedir. Koltuklara tıklayarak seçim yapabilirsiniz.</p>
                      <div className="overflow-x-auto">
                        <SalonPlanViewer plan={musensaalPlan} />
                      </div>
                    </div>
                  ) : null;
                })()}
                {(() => {
                  const planSections = sectionsByPlan[plan.id] || [];
                  if (!planSections.length) return null;
                  const sectionGroup = (name: string) => {
                    const n = String(name || "").toLowerCase();
                    if (n.includes("sol") || n.includes("left")) return 0;
                    if (n.includes("sağ") || n.includes("sag") || n.includes("right")) return 2;
                    return 1;
                  };
                  const orderedSections = [...planSections].sort((a, b) => {
                    const sa = Number(a.sort_order);
                    const sb = Number(b.sort_order);
                    const oa = Number.isFinite(sa) ? sa : 0;
                    const ob = Number.isFinite(sb) ? sb : 0;
                    if (oa !== ob) return oa - ob;
                    return String(a.name || "").localeCompare(String(b.name || ""), undefined, { numeric: true, sensitivity: "base" });
                  });
                  const hasAnyRows = orderedSections.some((s) => (rowsBySection[s.id] || []).length > 0);
                  if (!hasAnyRows) return null;
                  const leftSections = orderedSections.filter((s) => sectionGroup(s.name) === 0);
                  const centerSections = orderedSections.filter((s) => sectionGroup(s.name) === 1);
                  const rightSections = orderedSections.filter((s) => sectionGroup(s.name) === 2);
                  const onlyCenterSide =
                    leftSections.length === 0 && rightSections.length === 0 && centerSections.length > 0;
                  const renderSectionCard = (section: SeatingPlanSection) => {
                    const align = getSectionAlign(section.id, section.name, section.section_align ?? null);
                    const side = sectionNameGroup(section.name).side;
                    const rows = rowsBySection[section.id] || [];
                    if (!rows.length) return null;
                    const cm = section.corridor_mode ?? "none";
                    const afterSeat = (section.corridor_after_seat_label ?? "").trim();
                    /** En az ~16 koltuk tek satırda sığsın (önizleme); dar ekranda yatay kaydırma. */
                    const sectionCardClass =
                      cm === "horizontal"
                        ? "min-w-0 w-full basis-full shrink-0 rounded border border-slate-200 bg-white p-1"
                        : onlyCenterSide
                          ? "min-w-[min(100%,34rem)] w-max max-w-full shrink-0 rounded border border-slate-200 bg-white p-1"
                          : "min-w-[min(100%,34rem)] w-max max-w-full shrink-0 rounded border border-slate-200 bg-white p-1";
                    return (
                      <div key={section.id} className={sectionCardClass}>
                        <div className="mb-1 flex items-center justify-between gap-1">
                          <div className="text-xs font-semibold text-slate-700">{section.name}</div>
                          <div className="inline-flex rounded border border-slate-300 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => setSectionAlignDraft((prev) => ({ ...prev, [section.id]: "left" }))}
                              className={`rounded px-1.5 py-0.5 text-[10px] ${align === "left" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                            >
                              Sola Yasla
                            </button>
                            <button
                              type="button"
                              onClick={() => setSectionAlignDraft((prev) => ({ ...prev, [section.id]: "center" }))}
                              className={`rounded px-1.5 py-0.5 text-[10px] ${align === "center" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                            >
                              Ortala
                            </button>
                            <button
                              type="button"
                              onClick={() => setSectionAlignDraft((prev) => ({ ...prev, [section.id]: "right" }))}
                              className={`rounded px-1.5 py-0.5 text-[10px] ${align === "right" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                            >
                              Sağa Yasla
                            </button>
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          {rows.map((row) => {
                            const rowLabel = String(row.row_label || "");
                            const seats = sortSeatsByLabel(seatsByRow[row.id] || []);
                            const rowTicket =
                              (rowTicketLabelDraft[row.id] ??
                                row.ticket_type_label ??
                                sectionTicketLabel[section.id] ??
                                section.ticket_type_label ??
                                ""
                              ).trim();
                            const seatSplit =
                              cm === "vertical" && afterSeat
                                ? splitSeatsAfterSeatLabel(seats, afterSeat)
                                : null;
                            const renderSeatDot = (seat: Seat) => (
                              <span
                                key={seat.id}
                                className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-medium text-white transition-colors ${getTicketColor(rowTicket)} hover:!bg-[#39ff14] hover:!text-slate-900 hover:ring-2 hover:ring-[#166534]`}
                                title={`${section.name} · Sıra ${rowLabel} · Koltuk ${seat.seat_label}${rowTicket ? ` · ${rowTicket}` : ""}`}
                              >
                                {seat.seat_label}
                              </span>
                            );
                            const seatClusterClass = `flex flex-nowrap gap-1 items-center ${
                              align === "left"
                                ? "justify-start"
                                : align === "right"
                                ? "justify-end"
                                : "justify-center"
                            }`;
                            return (
                              <div key={row.id} className="flex min-w-0 items-center gap-1">
                                {side !== "right" && (
                                  <div className="w-10 shrink-0 text-[11px] font-medium text-slate-600 text-left">S{rowLabel}</div>
                                )}
                                <div
                                  className={`flex min-w-0 flex-nowrap gap-1 flex-1 items-center overflow-x-auto ${align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center"}`}
                                >
                                  {seatSplit ? (
                                    <>
                                      <div className={seatClusterClass}>{seatSplit[0].map(renderSeatDot)}</div>
                                      <div
                                        className="w-2 shrink-0 self-stretch min-h-[1.25rem] rounded-sm bg-amber-200/90 border border-amber-400/60"
                                        title={`Koridor: koltuk ${afterSeat} sonrası`}
                                      />
                                      <div className={seatClusterClass}>{seatSplit[1].map(renderSeatDot)}</div>
                                    </>
                                  ) : (
                                    <div className={seatClusterClass}>{seats.map(renderSeatDot)}</div>
                                  )}
                                </div>
                                {side === "right" && (
                                  <div className="w-10 shrink-0 text-[11px] font-medium text-slate-600 text-right">S{rowLabel}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  };
                  return (
                    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
                      <h3 className="text-sm font-semibold text-slate-800 mb-2">Salon önizleme (canlı taslak)</h3>
                      <p className="text-xs text-slate-500 mb-3">
                        Bu alan kaydetmeden önce mevcut taslağı gösterir. Veritabanına yazmak için <strong>Salonu Kaydet</strong> kullanın. Bölüm sırası listedeki
                        sıraya göredir; yalnızca isimde <em>sol/left</em> veya <em>sağ/right</em> geçenler yan koridorun solunda veya sağında, diğerleri altta yan
                        yana yerleşir. <strong>Yatay koridor</strong> modundaki bölüm önizlemede tam satır kaplar; altındaki bloklar bir sonraki satıra iner.
                      </p>
                      <div className="overflow-x-auto">
                        <div className="min-w-0 max-w-full rounded-lg border border-slate-100 bg-slate-50 p-2">
                          <div className="mx-auto mb-2 w-64 rounded bg-slate-800 py-1.5 text-center text-xs font-semibold tracking-wide text-white">
                            SAHNE
                          </div>
                          {onlyCenterSide ? (
                            <div className="flex w-full flex-col items-center gap-y-1">
                              {(() => {
                                const rows: ReactNode[] = [];
                                let idx = 0;
                                while (idx < centerSections.length) {
                                  const remaining = centerSections.length - idx;
                                  const inRow = remaining === 1 ? 1 : 2;
                                  const slice = centerSections.slice(idx, idx + inRow);
                                  rows.push(
                                    <div
                                      key={`preview-row-${idx}`}
                                      className="flex w-full flex-row flex-wrap items-start justify-center gap-x-1 gap-y-1"
                                    >
                                      {slice.map((s) => renderSectionCard(s))}
                                    </div>
                                  );
                                  idx += inRow;
                                }
                                return rows;
                              })()}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-1">
                                <div className="flex min-w-0 flex-col gap-1">
                                  {leftSections.map((s) => renderSectionCard(s))}
                                </div>
                                <div
                                  className="w-3 min-h-[4rem] shrink-0 self-stretch rounded bg-slate-200/80"
                                  title="Koridor"
                                />
                                <div className="flex min-w-0 flex-col gap-1">
                                  {rightSections.map((s) => renderSectionCard(s))}
                                </div>
                              </div>
                              {centerSections.length > 0 ? (
                                <div className="flex flex-wrap items-start justify-center gap-x-1 gap-y-1 border-t border-slate-200/80 pt-1">
                                  {centerSections.map((s) => renderSectionCard(s))}
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex flex-wrap items-end gap-2 mt-2 mb-4">
                  <label className="flex flex-col gap-1 text-xs text-slate-600 min-w-[140px]">
                    Bölüm adı
                    <input
                      type="text"
                      value={newSectionName[plan.id] ?? ""}
                      onChange={(e) => setNewSectionName((prev) => ({ ...prev, [plan.id]: e.target.value }))}
                      placeholder="örn. Blok A, Parket Sol"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full max-w-xs"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-600 w-44">
                    Koridor
                    <select
                      value={newSectionCorridorMode[plan.id] ?? "none"}
                      onChange={(e) =>
                        setNewSectionCorridorMode((prev) => ({
                          ...prev,
                          [plan.id]: e.target.value as "none" | "horizontal" | "vertical",
                        }))
                      }
                      className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                      title="Yatay: üst-alt bölüm blokları arasında sabit boşluk. Dikey: her sırayı yazdığınız koltuk etiketinden sonra böler (örn. 10 → 1–10 | koridor | 11+)."
                    >
                      <option value="none">Yok</option>
                      <option value="horizontal">Yatay (bloklar arası)</option>
                      <option value="vertical">Dikey (koltuktan sonra)</option>
                    </select>
                  </label>
                  {(newSectionCorridorMode[plan.id] ?? "none") === "vertical" && (
                    <label className="flex flex-col gap-1 text-xs text-slate-600 w-28">
                      Koltuk no
                      <input
                        type="text"
                        inputMode="numeric"
                        value={newSectionCorridorAfterSeat[plan.id] ?? ""}
                        onChange={(e) =>
                          setNewSectionCorridorAfterSeat((prev) => ({
                            ...prev,
                            [plan.id]: e.target.value,
                          }))
                        }
                        placeholder="örn. 10"
                        className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddSection(plan.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200"
                  >
                    <Plus className="h-4 w-4" /> Bölüm ekle
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSavePlan(plan.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-white hover:bg-primary-700"
                  >
                    Salonu Kaydet
                  </button>
                </div>
                {saveFeedbackByPlan[plan.id] && (
                  <p
                    className={`-mt-2 mb-4 text-xs ${
                      saveFeedbackByPlan[plan.id]?.type === "ok"
                        ? "text-emerald-700"
                        : saveFeedbackByPlan[plan.id]?.type === "saving"
                        ? "text-slate-600"
                        : "text-red-600"
                    }`}
                  >
                    {saveFeedbackByPlan[plan.id]?.message}
                  </p>
                )}
                {(sectionsByPlan[plan.id] || []).map((section) => (
                  <div key={section.id} className="ml-4 mt-4 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedSection((prev) => (prev === section.id ? null : section.id))}
                        className="flex items-center gap-2 text-left font-medium text-slate-800"
                      >
                        {expandedSection === section.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        {section.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSection(section.id, plan.id, section.name)}
                        className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        title="Bölümü sil"
                      >
                        <Trash2 className="h-3 w-3" />
                        Bölümü Sil
                      </button>
                    </div>
                    {expandedSection === section.id && (
                      <div className="mt-3 ml-4 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:gap-3">
                          <div>
                            <label className="text-sm text-slate-600 block mb-1">Bilet türü (etkinlikte eşlenecek)</label>
                            <TicketTypeLabelSelect
                              value={
                                sectionTicketLabel[section.id] ??
                                (section as SeatingPlanSection & { ticket_type_label?: string }).ticket_type_label ??
                                ""
                              }
                              onChange={(next) =>
                                setSectionTicketLabel((prev) => ({ ...prev, [section.id]: next }))
                              }
                            />
                          </div>
                          <p className="text-xs text-slate-500 max-w-md pt-1">
                            Listeyi{" "}
                            <Link href="/yonetim/bilet-turleri" className="text-primary-600 hover:underline">
                              Bilet türleri
                            </Link>{" "}
                            ile uyumlu tutun; etkinlikte oluşturduğunuz <code className="text-[11px]">tickets.name</code> ile birebir aynı olmalı.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-end gap-2 rounded border border-slate-200 bg-white p-2">
                          <label className="flex flex-col gap-1 text-xs text-slate-600 w-44">
                            Koridor (önizleme)
                            <select
                              value={section.corridor_mode ?? "none"}
                              onChange={(e) => {
                                const m = e.target.value as "none" | "horizontal" | "vertical";
                                setSectionsByPlan((prev) => ({
                                  ...prev,
                                  [plan.id]: (prev[plan.id] || []).map((s) =>
                                    s.id === section.id
                                      ? {
                                          ...s,
                                          corridor_mode: m,
                                          corridor_gap_px: 0,
                                          corridor_after_seat_label:
                                            m === "vertical"
                                              ? (s.corridor_after_seat_label ?? "").trim() || null
                                              : null,
                                        }
                                      : s
                                  ),
                                }));
                              }}
                              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
                            >
                              <option value="none">Yok</option>
                              <option value="horizontal">Yatay (bloklar arası)</option>
                              <option value="vertical">Dikey (koltuktan sonra)</option>
                            </select>
                          </label>
                          {(section.corridor_mode ?? "none") === "vertical" && (
                            <label className="flex flex-col gap-1 text-xs text-slate-600 w-28">
                              Koltuk no
                              <input
                                type="text"
                                inputMode="numeric"
                                value={section.corridor_after_seat_label ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setSectionsByPlan((prev) => ({
                                    ...prev,
                                    [plan.id]: (prev[plan.id] || []).map((s) =>
                                      s.id === section.id ? { ...s, corridor_after_seat_label: v || null } : s
                                    ),
                                  }));
                                }}
                                placeholder="örn. 10"
                                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                              />
                            </label>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <input
                            type="text"
                            value={newRowLabel[section.id] ?? ""}
                            onChange={(e) => setNewRowLabel((prev) => ({ ...prev, [section.id]: e.target.value }))}
                            placeholder="Sıra: boş=sonraki no, 11-14 veya A"
                            className="rounded-lg border border-slate-300 px-3 py-2 w-36"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddRow(section.id, plan.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-300 text-sm"
                          >
                            <Plus className="h-3 w-3" /> Sıra ekle
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFillMissingNumericRowsInSection(section.id)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                            title="Mevcut min–max sayısal sıra aralığındaki boşlukları doldurur (örn. 1 ve 5 varsa 2–4 eklenir). 11–14 için üstteki kutuya 11-14 yazın."
                          >
                            Aradaki eksik sıralar
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white p-2">
                          <span className="text-xs text-slate-600">Toplu kategori ata:</span>
                          <input
                            type="text"
                            value={rowRangeAssign[section.id]?.range ?? ""}
                            onChange={(e) =>
                              setRowRangeAssign((prev) => ({
                                ...prev,
                                [section.id]: { range: e.target.value, label: prev[section.id]?.label ?? "" },
                              }))
                            }
                            placeholder="Orn: 2-4"
                            className="rounded border border-slate-300 px-2 py-1 text-xs w-24"
                          />
                          <input
                            type="text"
                            value={rowRangeAssign[section.id]?.label ?? ""}
                            onChange={(e) =>
                              setRowRangeAssign((prev) => ({
                                ...prev,
                                [section.id]: { range: prev[section.id]?.range ?? "", label: e.target.value },
                              }))
                            }
                            placeholder="Kategori 1 / VIP"
                            className="rounded border border-slate-300 px-2 py-1 text-xs w-36"
                          />
                          <button
                            type="button"
                            onClick={() => applyRowRangeTicketLabel(section.id)}
                            className="rounded bg-slate-800 px-2 py-1 text-xs text-white hover:bg-slate-900"
                          >
                            Uygula
                          </button>
                        </div>
                        <div className="rounded border border-slate-200 bg-white p-2 space-y-2">
                          <p className="text-xs font-medium text-slate-700">Toplu sıra + koltuk ızgarası</p>
                          <p className="text-[11px] text-slate-500">
                            Örneğin sıra <strong>1-100</strong>, koltuk <strong>1-25</strong>: eksik sıraları oluşturur; her sıraya bu numaralı koltukları ekler (mevcut etiketleri silmez).
                          </p>
                          <div className="flex flex-wrap items-end gap-2">
                            <label className="flex flex-col gap-0.5 text-xs text-slate-600">
                              Sıra aralığı
                              <input
                                type="text"
                                inputMode="numeric"
                                value={bulkGridRows[section.id] ?? ""}
                                onChange={(e) =>
                                  setBulkGridRows((prev) => ({ ...prev, [section.id]: e.target.value }))
                                }
                                placeholder="1-100"
                                className="rounded border border-slate-300 px-2 py-1 w-24 text-sm"
                              />
                            </label>
                            <label className="flex flex-col gap-0.5 text-xs text-slate-600">
                              Koltuk aralığı
                              <input
                                type="text"
                                inputMode="numeric"
                                value={bulkGridSeats[section.id] ?? ""}
                                onChange={(e) =>
                                  setBulkGridSeats((prev) => ({ ...prev, [section.id]: e.target.value }))
                                }
                                placeholder="1-25"
                                className="rounded border border-slate-300 px-2 py-1 w-24 text-sm"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => bulkFillNumericGrid(section.id)}
                              className="rounded bg-primary-600 px-3 py-1.5 text-xs text-white hover:bg-primary-700"
                            >
                              Izgarayı doldur
                            </button>
                          </div>
                        </div>
                        <div className="rounded border border-slate-200 bg-white p-2 space-y-1">
                          <p className="text-xs font-medium text-slate-700">Kategori sihirbazı (sıra aralığı → bilet adı)</p>
                          <p className="text-[11px] text-slate-500">
                            Satır başına: <code className="text-[10px]">1-5 VIP</code> — etkinlikteki bilet adıyla aynı yazın. Boş satırlar ve # ile başlayanlar yok sayılır.
                          </p>
                          <textarea
                            value={categoryWizardText[section.id] ?? ""}
                            onChange={(e) =>
                              setCategoryWizardText((prev) => ({ ...prev, [section.id]: e.target.value }))
                            }
                            placeholder={"1-5 VIP\n6-10 Kategori 1\n11-13 Kategori 3"}
                            rows={4}
                            className="w-full max-w-md rounded border border-slate-300 px-2 py-1.5 text-xs font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => applyCategoryWizardLines(section.id)}
                            className="rounded bg-slate-800 px-2 py-1 text-xs text-white hover:bg-slate-900"
                          >
                            Sıra kategorilerini uygula
                          </button>
                        </div>
                        {(rowsBySection[section.id] || []).map((row) => {
                          const soldSet = new Set(soldSeatIdsByPlan[plan.id] ?? []);
                          const rowHasSoldSeat = (seatsByRow[row.id] || []).some((s) => soldSet.has(s.id));
                          return (
                          <div key={row.id} className="rounded border border-slate-200 bg-white p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-slate-700">Sıra {row.row_label}</p>
                              <button
                                type="button"
                                disabled={rowHasSoldSeat}
                                onClick={() => handleDeleteRow(row.id, section.id, plan.id)}
                                className={`p-1 rounded ${
                                  rowHasSoldSeat
                                    ? "text-slate-300 cursor-not-allowed"
                                    : "hover:bg-red-50 text-slate-500 hover:text-red-600"
                                }`}
                                title={
                                  rowHasSoldSeat
                                    ? "Sırada satılmış koltuk var; sıra silinemez"
                                    : "Sırayı ve tüm koltuklarını sil"
                                }
                                aria-label={`Sıra ${row.row_label} sil`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <label className="text-xs text-slate-600">Sıra kategorisi:</label>
                              <input
                                type="text"
                                value={rowTicketLabelDraft[row.id] ?? (row.ticket_type_label || "")}
                                onChange={(e) =>
                                  setRowTicketLabelDraft((prev) => ({ ...prev, [row.id]: e.target.value }))
                                }
                                placeholder="VIP / Kategori 1"
                                className="rounded border border-slate-300 px-2 py-1 text-xs w-40"
                              />
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={newSeatRange[row.id] ?? ""}
                                onChange={(e) => setNewSeatRange((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                placeholder="Koltuk: 1 veya 1-20"
                                className="rounded border border-slate-300 px-2 py-1 w-28 text-sm"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddSeats(row.id, section.id)}
                                className="text-sm text-primary-600 hover:text-primary-700"
                              >
                                Ekle
                              </button>
                              <span className="text-slate-500 text-sm">
                                ({(seatsByRow[row.id] || []).length} koltuk)
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {sortSeatsByLabel(seatsByRow[row.id] || []).map((s) => {
                                const isSoldSeat = soldSet.has(s.id);
                                return (
                                <span
                                  key={s.id}
                                  className={`inline-flex items-center gap-0.5 rounded pl-2 pr-1 py-0.5 text-xs ${
                                    isSoldSeat
                                      ? "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-400"
                                      : s.sales_blocked
                                        ? "bg-amber-100 text-amber-950 ring-1 ring-amber-300"
                                        : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {s.seat_label}
                                  {isSoldSeat ? (
                                    <span className="text-[10px] font-semibold text-emerald-800 px-0.5" title="İptal edilmemiş siparişte">
                                      Satıldı
                                    </span>
                                  ) : null}
                                  <button
                                    type="button"
                                    disabled={isSoldSeat}
                                    onClick={() =>
                                      setSeatsByRow((prev) => ({
                                        ...prev,
                                        [row.id]: (prev[row.id] || []).map((st) =>
                                          st.id === s.id ? { ...st, sales_blocked: !st.sales_blocked } : st
                                        ),
                                      }))
                                    }
                                    className={`p-0.5 rounded ${
                                      isSoldSeat
                                        ? "text-slate-300 cursor-not-allowed"
                                        : s.sales_blocked
                                          ? "hover:bg-slate-200 text-amber-800"
                                          : "hover:bg-slate-200 text-slate-500 hover:text-amber-700"
                                    }`}
                                    title={
                                      isSoldSeat
                                        ? "Satılmış koltukta satış engeli değiştirilemez"
                                        : s.sales_blocked
                                          ? "Satışa aç"
                                          : "Satışa kapat"
                                    }
                                    aria-label={
                                      s.sales_blocked ? `Koltuk ${s.seat_label} satışa aç` : `Koltuk ${s.seat_label} satışa kapat`
                                    }
                                  >
                                    <Ban className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSoldSeat}
                                    onClick={() => handleDeleteSeat(s.id, row.id, plan.id)}
                                    className={`p-0.5 rounded ${
                                      isSoldSeat
                                        ? "text-slate-300 cursor-not-allowed"
                                        : "hover:bg-red-100 text-slate-500 hover:text-red-600"
                                    }`}
                                    title={isSoldSeat ? "Satılmış koltuk silinemez" : "Koltuk sil"}
                                    aria-label={`Koltuk ${s.seat_label} sil`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </span>
                              );})}
                            </div>
                            <LazySeatingKonvaRowEditor
                              rowId={row.id}
                              rowLabel={row.row_label}
                              seats={seatsByRow[row.id] || []}
                              onSeatsDraftChange={(nextSeats) => {
                                setSeatsByRow((prev) => ({ ...prev, [row.id]: nextSeats }));
                              }}
                            />
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {plans.length === 0 && (
        <p className="mt-6 text-slate-500">
          Henüz salon yok. Yukarıdan &quot;Yeni salon&quot; veya &quot;2 salon ekle&quot; / &quot;3 salon ekle&quot; ile ekleyin; her salona bölüm, sıra ve koltuk tanımlayın veya Salon Tasarım Vizöründen plan aktarın.
        </p>
      )}
    </div>
  );
}
