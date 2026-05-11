"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  LayoutGrid,
  Save,
  Building2,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import OrganizerOrAdminGuard from "@/components/OrganizerOrAdminGuard";
import Plan2BlockDesigner from "@/components/salon-builder/Plan2BlockDesigner";
import type { Block } from "@/components/salon-builder/Plan2BlockDesigner";
import { supabase } from "@/lib/supabase-client";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.2;
const PAN_STEP = 120;
/** Cerceve kullanici w/h ile kucultulebilir; icerik tasarsa kaydirilir. */
const BOX_MIN_W = 80;
const BOX_MIN_H = 72;
const PIN_MARGIN = 24;

type HorizontalFlow = "ltr" | "rtl";
type BlockZone =
  | "parkettLeft"
  | "parkettCenter"
  | "parkettRight"
  | "parkettRear"
  | "balconyLeft"
  | "balconyRight"
  | "balconyRear"
  | "stageBackBalcony";

type HorizontalPin = "none" | "left" | "right";

type BlockSettings = {
  zone: BlockZone;
  horizontalFlow: HorizontalFlow;
  verticalFlow: "topToBottom" | "bottomToTop";
  /** Tuvalde yatay konumu sabitler; orta blokla calisirken kenar bloklar kaymaz. */
  horizontalPin: HorizontalPin;
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
};

function defaultBlocks(): Block[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "Orta salon",
      blockType: "centerFront",
      rows: [
        {
          id: crypto.randomUUID(),
          rowNumber: 1,
          totalSeats: 20,
          segments: [],
        },
      ],
    },
  ];
}

function createQuickBlock(name: string, blockType: Block["blockType"] = "centerFront"): Block {
  return {
    id: crypto.randomUUID(),
    name,
    blockType,
    rows: [
      {
        id: crypto.randomUUID(),
        rowNumber: 1,
        totalSeats: 16,
        segments: [],
      },
    ],
  };
}

function cloneBlock(source: Block): Block {
  return {
    ...source,
    id: crypto.randomUUID(),
    name: `${source.name || "Blok"} Kopya`,
    rows: (source.rows || []).map((row) => ({
      ...row,
      id: crypto.randomUUID(),
      segments: (row.segments || []).map((seg) => ({ ...seg, id: crypto.randomUUID() })),
    })),
  };
}

function seatColor(category?: string) {
  if (!category) return "#94a3b8";
  const n = category.toLowerCase();
  if (n.includes("vip")) return "#f59e0b";
  if (n.includes("1")) return "#ef4444";
  if (n.includes("2")) return "#3b82f6";
  if (n.includes("3")) return "#10b981";
  return "#8b5cf6";
}

function getDefaultZoneFromBlockType(block: Block): BlockZone {
  const t = block.blockType || "";
  if (t.includes("left")) return "parkettLeft";
  if (t.includes("right")) return "parkettRight";
  if (t === "centerBack") return "parkettRear";
  return "parkettCenter";
}

function getSeatOrder(totalSeats: number, flow: HorizontalFlow): number[] {
  if (flow === "rtl") return Array.from({ length: totalSeats }, (_, i) => totalSeats - i);
  return Array.from({ length: totalSeats }, (_, i) => i + 1);
}

function zoneLabel(z: BlockZone): string {
  const map: Record<BlockZone, string> = {
    parkettLeft: "Parket Sol",
    parkettCenter: "Parket Orta",
    parkettRight: "Parket Sag",
    parkettRear: "Parket Arka",
    balconyLeft: "Balkon Sol",
    balconyRight: "Balkon Sag",
    balconyRear: "Balkon Arka",
    stageBackBalcony: "Sahne Arkasi Balkon",
  };
  return map[z];
}

function horizontalPinLabel(p: HorizontalPin): string {
  const map: Record<HorizontalPin, string> = {
    none: "Yok",
    left: "Sol kenara",
    right: "Sag kenara",
  };
  return map[p];
}

function horizontalFlowLabel(m: HorizontalFlow): string {
  const map: Record<HorizontalFlow, string> = {
    ltr: "Soldan Saga",
    rtl: "Sagdan Sola",
  };
  return map[m];
}

function getDefaultHorizontalFlow(block: Block): HorizontalFlow {
  const t = block.blockType || "";
  return t.includes("right") ? "rtl" : "ltr";
}

function getDefaultBlockSize(block: Block) {
  const vertical = isVerticalBlock(block);
  if (vertical) return { w: 210, h: 190 };
  return { w: 300, h: 170 };
}

/** Önizleme kutusu boyutu: kayitli w/h (icerikten bagimsiz); taşma icinde kaydirilir. */
function estimateBlockOuterPx(block: Block, s: BlockSettings): { w: number; h: number } {
  const def = getDefaultBlockSize(block);
  const minW = s.w ?? def.w;
  const minH = s.h ?? def.h;
  return {
    w: Math.max(BOX_MIN_W, minW),
    h: Math.max(BOX_MIN_H, minH),
  };
}

function getAutoPosition(index: number) {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: 320 + col * 330, y: 180 + row * 230 };
}

function isVerticalBlock(block: Block): boolean {
  return block.blockType === "leftVertical" || block.blockType === "rightVertical";
}

function WizardPreview({
  blocks,
  settingsByBlockId,
  editable = false,
  onSettingsChange,
  onDeleteBlock,
  onDuplicateBlock,
}: {
  blocks: Block[];
  settingsByBlockId: Record<string, BlockSettings>;
  editable?: boolean;
  onSettingsChange?: (blockId: string, patch: Partial<BlockSettings>) => void;
  onDeleteBlock?: (blockId: string) => void;
  onDuplicateBlock?: (blockId: string) => void;
}) {
  const GRID_SIZE = 16;
  const CANVAS_WIDTH = 1800;
  const CANVAS_HEIGHT = 1200;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.9);
  const [draggingCanvas, setDraggingCanvas] = useState(false);
  const panDragRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const blockDragRef = useRef({ x: 0, y: 0, blockX: 0, blockY: 0 });
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);
  const resizeRef = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set());

  const canvasDimensions = useMemo(() => {
    let w = CANVAS_WIDTH;
    let h = CANVAS_HEIGHT;
    let maxRightNonRight = CANVAS_WIDTH;
    for (const b of blocks) {
      const s = settingsByBlockId[b.id];
      if (!s) continue;
      const outer = estimateBlockOuterPx(b, s);
      const pin = s.horizontalPin ?? "none";
      if (pin === "right") continue;
      const left = pin === "left" ? PIN_MARGIN : s.x;
      maxRightNonRight = Math.max(maxRightNonRight, left + outer.w + 100);
      h = Math.max(h, s.y + outer.h + 100);
    }
    w = Math.max(CANVAS_WIDTH, maxRightNonRight);
    for (const b of blocks) {
      const s = settingsByBlockId[b.id];
      if (!s || (s.horizontalPin ?? "none") !== "right") continue;
      const outer = estimateBlockOuterPx(b, s);
      const left = Math.max(PIN_MARGIN, w - outer.w - PIN_MARGIN);
      w = Math.max(w, left + outer.w + 100);
    }
    return { w, h };
  }, [blocks, settingsByBlockId]);

  const canvasDimRef = useRef(canvasDimensions);
  canvasDimRef.current = canvasDimensions;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        setScale((s) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s + delta)));
      }
      /* Ctrl/Cmd disinda tekerlek: yerel kaydirma cubuklari (preventDefault yok) */
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    if (!draggingCanvas) return;
    const el = containerRef.current;
    const onMove = (e: MouseEvent) => {
      if (!el) return;
      const dx = e.clientX - panDragRef.current.x;
      const dy = e.clientY - panDragRef.current.y;
      el.scrollLeft = panDragRef.current.scrollLeft - dx;
      el.scrollTop = panDragRef.current.scrollTop - dy;
    };
    const onUp = () => setDraggingCanvas(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingCanvas]);

  useEffect(() => {
    if (!draggingBlockId || !onSettingsChange) return;
    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - blockDragRef.current.x) / scale;
      const dy = (e.clientY - blockDragRef.current.y) / scale;
      const { w: cw, h: ch } = canvasDimRef.current;
      const cur = settingsByBlockId[draggingBlockId];
      const pin = cur?.horizontalPin ?? "none";
      const rawY = Math.max(10, Math.min(ch - 40, blockDragRef.current.blockY + dy));
      const ny = Math.round(rawY / GRID_SIZE) * GRID_SIZE;
      if (pin === "left" || pin === "right") {
        onSettingsChange(draggingBlockId, { y: ny });
        return;
      }
      const rawX = Math.max(10, Math.min(cw - 40, blockDragRef.current.blockX + dx));
      const nx = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
      onSettingsChange(draggingBlockId, { x: nx, y: ny });
    };
    const onUp = () => setDraggingBlockId(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggingBlockId, onSettingsChange, scale, settingsByBlockId]);

  useEffect(() => {
    if (!resizingBlockId || !onSettingsChange) return;
    const onMove = (e: MouseEvent) => {
      const dx = (e.clientX - resizeRef.current.x) / scale;
      const dy = (e.clientY - resizeRef.current.y) / scale;
      const rawW = resizeRef.current.w + dx;
      const rawH = resizeRef.current.h + dy;
      const w = Math.max(BOX_MIN_W, Math.round(rawW / GRID_SIZE) * GRID_SIZE);
      const h = Math.max(BOX_MIN_H, Math.round(rawH / GRID_SIZE) * GRID_SIZE);
      onSettingsChange(resizingBlockId, { w, h });
    };
    const onUp = () => setResizingBlockId(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onSettingsChange, resizingBlockId, scale]);

  const showSeatDetails = scale >= 0.95;

  const renderBlock = (block: Block) => {
    const settings = settingsByBlockId[block.id];
    const horizontalFlow = settings?.horizontalFlow ?? getDefaultHorizontalFlow(block);
    const verticalFlow = settings?.verticalFlow ?? "topToBottom";
    const vertical = isVerticalBlock(block);
    const horizontalRows = verticalFlow === "bottomToTop" ? [...block.rows].reverse() : block.rows;
    const verticalRows = horizontalFlow === "rtl" ? [...block.rows].reverse() : block.rows;
    const startBlockDrag = (e: React.MouseEvent) => {
      if (!editable || !onSettingsChange) return;
      e.stopPropagation();
      const cur = settingsByBlockId[block.id];
      if (!cur) return;
      blockDragRef.current = { x: e.clientX, y: e.clientY, blockX: cur.x, blockY: cur.y };
      setDraggingBlockId(block.id);
    };
    const sFull = settings ?? {
      zone: getDefaultZoneFromBlockType(block),
      horizontalFlow: getDefaultHorizontalFlow(block),
      verticalFlow: "topToBottom" as const,
      horizontalPin: "none" as const,
      x: 80,
      y: 80,
      w: getDefaultBlockSize(block).w,
      h: getDefaultBlockSize(block).h,
      layer: 1,
    };
    const outer = estimateBlockOuterPx(block, sFull);
    const pin = sFull.horizontalPin ?? "none";
    const effLeft =
      pin === "left"
        ? PIN_MARGIN
        : pin === "right"
          ? Math.max(PIN_MARGIN, canvasDimensions.w - outer.w - PIN_MARGIN)
          : sFull.x;
    const dragCursor =
      editable && (pin === "left" || pin === "right") ? "cursor-ns-resize" : editable ? "cursor-move" : "";
    const scrollMaxH = Math.max(40, outer.h - 88);
    return (
      <div
        key={block.id}
        className={`absolute max-w-none rounded-lg border border-slate-200 bg-white p-3 shadow-sm ${dragCursor}`}
        style={{
          left: effLeft,
          top: sFull.y,
          width: outer.w,
          maxWidth: outer.w,
          maxHeight: outer.h,
          zIndex: sFull.layer,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
        onMouseDown={startBlockDrag}
      >
        <div className="mb-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">{block.name || "Blok"}</p>
            {editable && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateBlock?.(block.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="rounded border border-slate-200 p-1 text-slate-600 hover:bg-slate-100"
                  title="Kopyala"
                >
                  <Copy className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteBlock?.(block.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="rounded border border-rose-200 p-1 text-rose-600 hover:bg-rose-50"
                  title="Sil"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="mb-2 text-[10px] text-slate-500">
          {horizontalFlowLabel(horizontalFlow)}
          {` • ${verticalFlow === "topToBottom" ? "Yukarıdan aşağı" : "Aşağıdan yukarı"}`}
          {pin !== "none" ? ` • Sabit: ${horizontalPinLabel(pin)}` : ""}
        </p>
        <div className="overflow-auto" style={{ maxHeight: scrollMaxH }}>
        {vertical ? (
          !showSeatDetails ? (
            <div className="rounded bg-slate-200" style={{ width: Math.max(70, verticalRows.length * 18), height: 120 }} />
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                {verticalRows.map((row) => (
                  <span
                    key={`${row.id}-label`}
                    className="flex h-4 w-4 items-center justify-center text-[9px] font-semibold text-slate-500"
                    title={`Sıra ${row.rowNumber}`}
                  >
                    {row.rowNumber}
                  </span>
                ))}
              </div>
              {Array.from({ length: Math.max(...verticalRows.map((r) => r.totalSeats), 1) }, (_, seatIdx) => {
                return (
                  <div key={`${block.id}-depth-${seatIdx}`} className="flex items-center gap-1">
                    {verticalRows.map((row) => {
                      if (seatIdx >= row.totalSeats) return <div key={`${row.id}-empty-${seatIdx}`} className="h-4 w-4" />;
                      const displayNo = verticalFlow === "topToBottom" ? seatIdx + 1 : row.totalSeats - seatIdx;
                      const seatNo = displayNo;
                      const seg = row.segments.find((s) => seatNo >= s.fromSeat && seatNo <= s.toSeat);
                      const seatId = `${block.id}-${row.id}-${seatNo}`;
                      const selected = selectedSeatIds.has(seatId);
                      return (
                        <button
                          key={seatId}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (editable) return;
                            toggleSeat(seatId);
                          }}
                          className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-slate-900"
                          style={{ backgroundColor: selected ? "#39ff14" : seatColor(seg?.category) }}
                          title={`${block.name} • Sıra ${row.rowNumber} • Koltuk ${displayNo}`}
                        >
                          {displayNo}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-1">
            {horizontalRows.map((row) => {
              const order = getSeatOrder(row.totalSeats, horizontalFlow);
              const seats = Array.from({ length: row.totalSeats }, (_, i) => {
                const seg = row.segments.find((s) => i + 1 >= s.fromSeat && i + 1 <= s.toSeat);
                return { seatNo: i + 1, displayNo: order[i], category: seg?.category };
              });
              return (
                <div key={row.id} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-[10px] font-semibold text-slate-500">{row.rowNumber}</span>
                  {!showSeatDetails ? (
                    <div className="h-3 rounded bg-slate-200" style={{ width: Math.max(80, row.totalSeats * 6) }} />
                  ) : (
                    <div className="flex flex-nowrap gap-1">
                      {seats.map((s) => {
                        const seatId = `${block.id}-${row.id}-${s.seatNo}`;
                        const selected = selectedSeatIds.has(seatId);
                        return (
                          <button
                            key={seatId}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (editable) return;
                              toggleSeat(seatId);
                            }}
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-slate-900"
                            style={{ backgroundColor: selected ? "#39ff14" : seatColor(s.category) }}
                            title={`${block.name} • Sira ${row.rowNumber} • Koltuk ${s.displayNo}`}
                          >
                            {s.displayNo}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
        {editable && (
          <button
            type="button"
            className="absolute bottom-1 right-1 h-3 w-3 cursor-se-resize rounded-sm border border-slate-300 bg-slate-100"
            onMouseDown={(e) => {
              if (!onSettingsChange) return;
              e.stopPropagation();
              const cur = settingsByBlockId[block.id];
              if (!cur) return;
              resizeRef.current = { x: e.clientX, y: e.clientY, w: cur.w, h: cur.h };
              setResizingBlockId(block.id);
            }}
            title="Cerçeve boyutu (kucultmek icin surukleyin; icerik taşarsa kaydirilir)"
          />
        )}
      </div>
    );
  };

  const toggleSeat = (id: string) => {
    setSelectedSeatIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Uzakta: salon sekli • Yakinda: koltuk secimi ({showSeatDetails ? "detay acik" : "detay kapali"}). Kaydirma cubuklari veya fare tekeri • Yaklastir: Ctrl veya Cmd + tekerlek • Bos alana surukle: kaydir • Fare orta tus: kaydir.
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => setScale((s) => Math.min(MAX_ZOOM, s + ZOOM_STEP))} className="rounded border border-slate-300 px-2 py-1 text-xs">+</button>
          <button type="button" onClick={() => setScale((s) => Math.max(MIN_ZOOM, s - ZOOM_STEP))} className="rounded border border-slate-300 px-2 py-1 text-xs">-</button>
          <button type="button" onClick={() => { setScale(0.9); containerRef.current?.scrollTo(0, 0); }} className="rounded border border-slate-300 px-2 py-1 text-xs">Sifirla</button>
          <span className="mx-1 hidden text-slate-300 sm:inline">|</span>
          <button type="button" title="Yukari" onClick={() => containerRef.current?.scrollBy({ top: -PAN_STEP, behavior: "smooth" })} className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-100">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" title="Asagi" onClick={() => containerRef.current?.scrollBy({ top: PAN_STEP, behavior: "smooth" })} className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-100">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" title="Sol" onClick={() => containerRef.current?.scrollBy({ left: -PAN_STEP, behavior: "smooth" })} className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" title="Sag" onClick={() => containerRef.current?.scrollBy({ left: PAN_STEP, behavior: "smooth" })} className="rounded border border-slate-300 p-1 text-slate-600 hover:bg-slate-100">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-auto rounded-lg border border-slate-200 bg-slate-50"
        style={{ minHeight: 420, maxHeight: "70vh", cursor: draggingCanvas ? "grabbing" : "grab" }}
        onAuxClick={(e) => {
          if (e.button === 1) e.preventDefault();
        }}
        onMouseDown={(e) => {
          const el = containerRef.current;
          if (e.button === 1) {
            e.preventDefault();
            if (el) {
              panDragRef.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
            }
            setDraggingCanvas(true);
            return;
          }
          if (e.button !== 0) return;
          if (el) {
            panDragRef.current = { x: e.clientX, y: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
          }
          setDraggingCanvas(true);
        }}
      >
        <div
          style={{
            width: canvasDimensions.w * scale,
            height: canvasDimensions.h * scale,
            position: "relative",
          }}
        >
          <div
            className="relative m-6 rounded-xl border border-dashed border-slate-300 bg-white/70"
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "0 0",
              width: canvasDimensions.w,
              height: canvasDimensions.h,
              minWidth: CANVAS_WIDTH,
              minHeight: CANVAS_HEIGHT,
            }}
          >
            <div className="pointer-events-none absolute left-1/2 top-8 -translate-x-1/2 rounded bg-slate-800 px-8 py-2 text-sm font-semibold text-white">
              SAHNE
            </div>
            {blocks.map(renderBlock)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SalonYapimWizardPage() {
  const [blocks, setBlocks] = useState<Block[]>(defaultBlocks);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [saveInfo, setSaveInfo] = useState<string>("");
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [venueId, setVenueId] = useState("");
  const [planName, setPlanName] = useState("Salon plani");
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<{ venueId: string; planName: string } | null>(null);
  const [settingsByBlockId, setSettingsByBlockId] = useState<Record<string, BlockSettings>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("venues").select("id, name").order("name");
      const v = (data || []) as { id: string; name: string }[];
      setVenues(v);
      if (v.length > 0) setVenueId(v[0].id);
    })();
  }, []);

  useEffect(() => {
    setSettingsByBlockId((prev) => {
      const next: Record<string, BlockSettings> = {};
      for (const block of blocks) {
        const size = getDefaultBlockSize(block);
        const pos = getAutoPosition(Object.keys(next).length);
        const existing = prev[block.id];
        if (existing) {
          next[block.id] = {
            ...existing,
            horizontalPin: existing.horizontalPin ?? "none",
          };
        } else {
          next[block.id] = {
            zone: getDefaultZoneFromBlockType(block),
            horizontalFlow: getDefaultHorizontalFlow(block),
            verticalFlow: "topToBottom",
            horizontalPin: "none",
            x: pos.x,
            y: pos.y,
            w: size.w,
            h: size.h,
            layer: 1,
          };
        }
      }
      return next;
    });
  }, [blocks]);

  const saveDraft = async () => {
    setSaving(true);
    setSaveInfo("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/salon-yapim-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ plan2Blocks: blocks, savedAt: new Date().toISOString() }),
      });
      setSaveInfo(res.ok ? "Taslak kaydedildi." : "Kayit sirasinda hata oldu.");
    } finally {
      setSaving(false);
    }
  };

  const exportToVenue = async () => {
    if (!venueId || !planName.trim()) return;
    setExporting(true);
    setSaveInfo("");
    setLastExport(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/salon-yapim-to-venue", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          venueId,
          planName: planName.trim(),
          plan2Blocks: blocks.filter((b) => b.blockType !== "corridor"),
          settingsByBlockId,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaveInfo(json.message || "Mekana aktarildi.");
        setLastExport({ venueId, planName: planName.trim() });
      } else {
        setSaveInfo(json.error || "Aktarim basarisiz.");
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <OrganizerOrAdminGuard>
      <div className="mx-auto w-full max-w-[1700px] p-6 md:p-8">
        <div className="mb-5 flex items-center gap-4">
          <Link href="/yonetim/mekanlar" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Mekanlar
          </Link>
        </div>
        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <LayoutGrid className="h-6 w-6 text-primary-600" />
            Salon Yapim Wizard
          </h1>
          <p className="mt-1 text-slate-600">Yeni ve kolay akis: bloklari olustur, salonu tum sekliyle gor, yakinlasinca koltuk sec.</p>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s as 1 | 2 | 3)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${step === s ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              {s === 1 ? "1. Bloklar" : s === 2 ? "2. Onizleme" : "3. Kaydet / Aktar"}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="mb-2 text-sm font-semibold text-emerald-900">Hizli bolgeye blok ekle</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Parket Sol", zone: "parkettLeft" as BlockZone, type: "leftHorizontal" as Block["blockType"] },
                  { label: "Parket Orta", zone: "parkettCenter" as BlockZone, type: "centerFront" as Block["blockType"] },
                  { label: "Parket Sag", zone: "parkettRight" as BlockZone, type: "rightHorizontal" as Block["blockType"] },
                  { label: "Parket Arka", zone: "parkettRear" as BlockZone, type: "centerBack" as Block["blockType"] },
                  { label: "Balkon Sol", zone: "balconyLeft" as BlockZone, type: "leftVertical" as Block["blockType"] },
                  { label: "Balkon Sag", zone: "balconyRight" as BlockZone, type: "rightVertical" as Block["blockType"] },
                  { label: "Balkon Arka", zone: "balconyRear" as BlockZone, type: "centerBack" as Block["blockType"] },
                  { label: "Sahne Arkasi Balkon", zone: "stageBackBalcony" as BlockZone, type: "centerBack" as Block["blockType"] },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      const nb = createQuickBlock(opt.label, opt.type);
                      setBlocks((prev) => [...prev, nb]);
                      setSettingsByBlockId((prev) => ({
                        ...prev,
                        [nb.id]: {
                          zone: opt.zone,
                          horizontalFlow: opt.type?.includes("right") ? "rtl" : "ltr",
                          verticalFlow: "topToBottom",
                          horizontalPin: "none",
                          x: getAutoPosition(blocks.length).x,
                          y: getAutoPosition(blocks.length).y,
                          w: getDefaultBlockSize(nb).w,
                          h: getDefaultBlockSize(nb).h,
                          layer: 1,
                        },
                      }));
                    }}
                    className="rounded border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                  >
                    + {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <Plan2BlockDesigner blocks={blocks} onBlocksChange={setBlocks} />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Blok Yerlesimi ve Numaralandirma</h3>
              <div className="space-y-3">
                {blocks.map((block) => {
                  const setting = settingsByBlockId[block.id] ?? {
                    zone: getDefaultZoneFromBlockType(block),
                    horizontalFlow: getDefaultHorizontalFlow(block),
                    verticalFlow: "topToBottom" as const,
                    horizontalPin: "none" as const,
                    x: getAutoPosition(blocks.indexOf(block)).x,
                    y: getAutoPosition(blocks.indexOf(block)).y,
                    w: getDefaultBlockSize(block).w,
                    h: getDefaultBlockSize(block).h,
                    layer: 1,
                  };
                  return (
                    <div key={block.id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-7">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{block.name || "Blok"}</p>
                        <p className="text-xs text-slate-500">{block.rows.length} sira</p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Bolge</label>
                        <select
                          value={setting.zone}
                          onChange={(e) => {
                            const zone = e.target.value as BlockZone;
                            setSettingsByBlockId((prev) => ({ ...prev, [block.id]: { ...setting, zone } }));
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          {(["parkettLeft","parkettCenter","parkettRight","parkettRear","balconyLeft","balconyRight","balconyRear","stageBackBalcony"] as BlockZone[]).map((zone) => (
                            <option key={zone} value={zone}>{zoneLabel(zone)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Yatay Numaralandirma</label>
                        <select
                          value={setting.horizontalFlow}
                          onChange={(e) => {
                            const horizontalFlow = e.target.value as HorizontalFlow;
                            setSettingsByBlockId((prev) => ({ ...prev, [block.id]: { ...setting, horizontalFlow } }));
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          {(["ltr","rtl"] as HorizontalFlow[]).map((m) => (
                            <option key={m} value={m}>{horizontalFlowLabel(m)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Dikey Sıra Akışı</label>
                        <select
                          value={setting.verticalFlow}
                          onChange={(e) => {
                            const verticalFlow = e.target.value as BlockSettings["verticalFlow"];
                            setSettingsByBlockId((prev) => ({ ...prev, [block.id]: { ...setting, verticalFlow } }));
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          <option value="topToBottom">Yukarıdan aşağı</option>
                          <option value="bottomToTop">Aşağıdan yukarı</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Tuvalde yatay sabitle</label>
                        <select
                          value={setting.horizontalPin ?? "none"}
                          onChange={(e) => {
                            const horizontalPin = e.target.value as HorizontalPin;
                            setSettingsByBlockId((prev) => ({ ...prev, [block.id]: { ...setting, horizontalPin } }));
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          {(["none", "left", "right"] as HorizontalPin[]).map((p) => (
                            <option key={p} value={p}>{horizontalPinLabel(p)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">X</label>
                        <input
                          type="number"
                          value={Math.round(setting.x)}
                          disabled={setting.horizontalPin === "left" || setting.horizontalPin === "right"}
                          title={
                            setting.horizontalPin === "left" || setting.horizontalPin === "right"
                              ? "Sabit blokta X onizlemede otomatik (sol/sag kenar)"
                              : undefined
                          }
                          onChange={(e) => {
                            const x = Number(e.target.value || 0);
                            setSettingsByBlockId((prev) => ({ ...prev, [block.id]: { ...setting, x } }));
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Y</label>
                        <input
                          type="number"
                          value={Math.round(setting.y)}
                          onChange={(e) => {
                            const y = Number(e.target.value || 0);
                            setSettingsByBlockId((prev) => ({ ...prev, [block.id]: { ...setting, y } }));
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <WizardPreview
              blocks={blocks}
              settingsByBlockId={settingsByBlockId}
              editable
              onSettingsChange={(blockId, patch) => {
                setSettingsByBlockId((prev) => ({
                  ...prev,
                  [blockId]: { ...prev[blockId], ...patch },
                }));
              }}
              onDeleteBlock={(blockId) => {
                setBlocks((prev) => prev.filter((b) => b.id !== blockId));
                setSettingsByBlockId((prev) => {
                  const next = { ...prev };
                  delete next[blockId];
                  return next;
                });
              }}
              onDuplicateBlock={(blockId) => {
                const source = blocks.find((b) => b.id === blockId);
                if (!source) return;
                const newBlock = cloneBlock(source);
                const sourceSettings = settingsByBlockId[blockId];
                setBlocks((prev) => [...prev, newBlock]);
                setSettingsByBlockId((prev) => ({
                  ...prev,
                  [newBlock.id]: {
                    ...(sourceSettings || {
                      zone: getDefaultZoneFromBlockType(newBlock),
                      horizontalFlow: getDefaultHorizontalFlow(newBlock),
                      verticalFlow: "topToBottom",
                      horizontalPin: "none",
                      x: 320,
                      y: 180,
                      w: getDefaultBlockSize(newBlock).w,
                      h: getDefaultBlockSize(newBlock).h,
                      layer: 1,
                    }),
                    x: (sourceSettings?.x ?? 320) + 32,
                    y: (sourceSettings?.y ?? 180) + 32,
                  },
                }));
              }}
            />
          </div>
        )}

        {step === 2 && <WizardPreview blocks={blocks} settingsByBlockId={settingsByBlockId} />}

        {step === 3 && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Kaydediliyor..." : "Taslak Kaydet"}
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Mekan</label>
                <select value={venueId} onChange={(e) => setVenueId(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="">Mekan secin</option>
                  {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Plan adi</label>
                <input value={planName} onChange={(e) => setPlanName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </div>
            </div>
            <button
              type="button"
              onClick={exportToVenue}
              disabled={exporting || !venueId || !planName.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
            >
              <Building2 className="h-4 w-4" />
              {exporting ? "Aktariliyor..." : "Mekana Aktar"}
            </button>
            {saveInfo && <p className="text-sm text-slate-700">{saveInfo}</p>}
            {lastExport && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <p className="mb-2">
                  <strong>{lastExport.planName}</strong> adlı salon, seçtiğiniz mekanın <strong>Oturum Planı</strong> altına eklendi.
                </p>
                <Link
                  href={`/yonetim/mekanlar/${lastExport.venueId}/oturum-plani`}
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-600 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  Oturum Planı sayfasını aç
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <p className="mb-1 font-semibold text-slate-700">Nereye kaydedilir?</p>
              <ul className="list-inside list-disc space-y-0.5">
                <li>
                  <strong>Taslak Kaydet</strong>: bu sihirbazda son durumu saklar (isim kullanılmaz, listede gözükmez).
                </li>
                <li>
                  <strong>Mekana Aktar</strong>: salon, seçilen mekanın <em>Oturum Planı</em> sayfasında <em>Plan adı</em> ile listelenir.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </OrganizerOrAdminGuard>
  );
}

