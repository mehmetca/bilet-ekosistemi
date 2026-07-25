"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Copy,
  LayoutGrid,
  Move,
  Plus,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { applyPreset, PRESET_OPTIONS } from "@/lib/salon-wizard-2/presets";
import { buildSectionPreview } from "@/lib/salon-wizard-2/numbering";
import { aggregateTicketPreview, countDraftSeats } from "@/lib/salon-wizard-2/to-template";
import {
  CATEGORY_PRESETS,
  ZONE_OPTIONS,
  appendCategoryBand,
  categoryForRowIndex,
  createBand,
  createDefaultDraft,
  createEmptySection,
  normalizeCategoryBands,
  type CategoryBand,
  type SectionZone,
  type TicketNamingMode,
  type Wizard2Draft,
  type Wizard2Section,
} from "@/lib/salon-wizard-2/types";

type VenueOption = { id: string; name: string };
type StepId = 1 | 2 | 3 | 4;

const STEPS: { id: StepId; title: string; desc: string }[] = [
  { id: 1, title: "Başla", desc: "Şablon / plan adı" },
  { id: 2, title: "Salon düzeni", desc: "Blok + sıra → kategori" },
  { id: 3, title: "Özet", desc: "Etkinlikte görünecekler" },
  { id: 4, title: "Mekana aktar", desc: "Kaydet" },
];

function zoneLabel(zone: SectionZone): string {
  return ZONE_OPTIONS.find((z) => z.value === zone)?.label ?? zone;
}

function categorySeatClass(category: string, blocked: boolean): string {
  if (blocked) return "bg-gray-300 border-gray-400 text-gray-700";
  const c = category.toLowerCase();
  if (c.includes("vip")) return "bg-amber-100 border-amber-300 text-amber-950";
  if (c.includes("1")) return "bg-rose-100 border-rose-300 text-rose-950";
  if (c.includes("2")) return "bg-sky-100 border-sky-300 text-sky-950";
  if (c.includes("3")) return "bg-emerald-100 border-emerald-300 text-emerald-950";
  if (c.includes("4")) return "bg-violet-100 border-violet-300 text-violet-950";
  return "bg-slate-100 border-slate-300 text-slate-800";
}

function normalizeSectionForPreview(raw: Wizard2Section): Wizard2Section {
  return {
    ...createEmptySection(),
    ...raw,
    id: raw.id || crypto.randomUUID(),
    name: (raw.name || "Bölüm").trim() || "Bölüm",
    zone: raw.zone || "parkett_center",
    rowCount: Math.max(1, Number(raw.rowCount) || 1),
    seatsPerRow: Math.max(1, Number(raw.seatsPerRow) || 1),
    rowLabelStart: Math.max(1, Number(raw.rowLabelStart) || 1),
    showRowEndNumbers: raw.showRowEndNumbers !== false,
    direction: raw.direction === "rtl" ? "rtl" : "ltr",
    numberingMode: raw.numberingMode || "sequential",
    aisleAfterSeatIndex: raw.aisleAfterSeatIndex ?? null,
    aisleAfterRowNumbers: Array.isArray(raw.aisleAfterRowNumbers) ? raw.aisleAfterRowNumbers : [],
    salesBlockedKeys: Array.isArray(raw.salesBlockedKeys) ? raw.salesBlockedKeys : [],
    categoryBands: normalizeCategoryBands(raw),
  };
}

/** Mekana aktar öncesi: sürükle-kaydır + zoom ile tam salon önizleme */
function FullSalonPreview({ draft }: { draft: Wizard2Draft }) {
  const sections = useMemo(
    () => (Array.isArray(draft.sections) ? draft.sections.map(normalizeSectionForPreview) : []),
    [draft.sections]
  );

  const byZone = useMemo(() => {
    const map: Record<SectionZone, Wizard2Section[]> = {
      parkett_left: [],
      parkett_center: [],
      parkett_right: [],
      parkett_rear: [],
      balcony_left: [],
      balcony_right: [],
      balcony_rear: [],
    };
    for (const s of sections) {
      const zone = map[s.zone] ? s.zone : "parkett_center";
      map[zone].push(s);
    }
    return map;
  }, [sections]);

  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 24, y: 24 });
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const clampZoom = (z: number) => Math.min(2.5, Math.max(0.35, z));

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d?.active) return;
    setPan({
      x: d.origX + (e.clientX - d.startX),
      y: d.origY + (e.clientY - d.startY),
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const nudge = (dx: number, dy: number) => {
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  };

  const resetView = () => {
    setZoom(0.85);
    setPan({ x: 24, y: 24 });
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        setZoom((z) => clampZoom(z + delta));
      } else {
        e.preventDefault();
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const renderSection = (section: Wizard2Section) => {
    let rows: ReturnType<typeof buildSectionPreview> = [];
    try {
      rows = buildSectionPreview(section);
    } catch {
      rows = [];
    }
    const aisleIdx =
      section.aisleAfterSeatIndex != null && section.aisleAfterSeatIndex >= 1
        ? section.aisleAfterSeatIndex
        : null;

    return (
      <div
        key={section.id}
        className="rounded-lg border-2 border-teal-200 bg-white p-3 space-y-1.5 shadow-sm shrink-0"
      >
        <div className="flex items-baseline justify-between gap-2 min-w-max">
          <p className="text-sm font-semibold text-slate-900">{section.name}</p>
          <p className="text-[10px] text-slate-500 shrink-0">
            {section.rowCount} sıra · {section.seatsPerRow} koltuk
          </p>
        </div>
        <div className="space-y-0.5">
          {rows.length === 0 ? (
            <p className="text-xs text-red-600">Bu blok önizlenemedi.</p>
          ) : (
            rows.map((row, ri) => {
              const category = categoryForRowIndex(section, ri);
              return (
                <div key={`${section.id}-${row.rowLabel}-${ri}`}>
                  <div className="flex items-center gap-0.5 min-w-max">
                    <span className="w-5 shrink-0 text-[9px] text-slate-500 text-right tabular-nums">
                      {row.rowLabel}
                    </span>
                    {row.seats.map((seat, i) => (
                      <div key={`${row.rowLabel}-${seat.label}-${i}`} className="flex items-center gap-0.5">
                        <span
                          title={`${section.name} S${row.rowLabel} · ${seat.label} · ${category}${seat.blocked ? " (kapalı)" : ""}`}
                          className={[
                            "h-5 min-w-[1.15rem] px-0.5 rounded-[3px] border text-[8px] font-medium flex items-center justify-center tabular-nums",
                            categorySeatClass(category, seat.blocked),
                          ].join(" ")}
                        >
                          {seat.label}
                        </span>
                        {aisleIdx != null && i + 1 === aisleIdx && (
                          <span
                            className="w-1.5 h-5 rounded-sm bg-slate-200 border border-dashed border-slate-400"
                            title="Koridor"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  {row.aisleAfter && (
                    <div className="my-0.5 h-1.5 rounded bg-slate-100 border border-dashed border-slate-300" />
                  )}
                </div>
              );
            })
          )}
        </div>
        <p className="text-[11px] text-slate-600 min-w-max">
          {normalizeCategoryBands(section)
            .map((b) => `${b.fromRow}–${b.toRow} ${b.category}`)
            .join(" · ")}
        </p>
      </div>
    );
  };

  const hasBalcony =
    byZone.balcony_left.length + byZone.balcony_right.length + byZone.balcony_rear.length > 0;

  return (
    <div className="rounded-xl border-2 border-teal-300 bg-teal-50/40 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-teal-950">Salon önizleme — son hali</p>
          <p className="text-xs text-teal-900/70 flex items-center gap-1 mt-0.5">
            <Move className="w-3.5 h-3.5" />
            Sürükleyerek kaydır · fare tekerleği kaydırır · Ctrl+tekerlek yakınlaştırır
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            {[
              ["VIP", "bg-amber-100 border-amber-300"],
              ["Kat.1", "bg-rose-100 border-rose-300"],
              ["Kat.2", "bg-sky-100 border-sky-300"],
              ["Kat.3", "bg-emerald-100 border-emerald-300"],
            ].map(([label, cls]) => (
              <span key={label} className={`px-1.5 py-0.5 rounded border ${cls}`}>
                {label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-teal-200 bg-white p-1">
            <button
              type="button"
              className="p-1.5 rounded hover:bg-slate-100"
              title="Uzaklaştır"
              onClick={() => setZoom((z) => clampZoom(z - 0.15))}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs tabular-nums w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="p-1.5 rounded hover:bg-slate-100"
              title="Yakınlaştır"
              onClick={() => setZoom((z) => clampZoom(z + 0.15))}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="px-2 py-1 text-[11px] rounded hover:bg-slate-100 border-l border-slate-200 ml-0.5"
              onClick={resetView}
            >
              Sıfırla
            </button>
          </div>
          <div className="flex items-center gap-0.5 rounded-lg border border-teal-200 bg-white p-1">
            <button type="button" className="p-1.5 rounded hover:bg-slate-100" title="Yukarı" onClick={() => nudge(0, 80)}>
              <ArrowLeft className="w-4 h-4 rotate-90" />
            </button>
            <button type="button" className="p-1.5 rounded hover:bg-slate-100" title="Aşağı" onClick={() => nudge(0, -80)}>
              <ArrowRight className="w-4 h-4 rotate-90" />
            </button>
            <button type="button" className="p-1.5 rounded hover:bg-slate-100" title="Sola" onClick={() => nudge(80, 0)}>
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button type="button" className="p-1.5 rounded hover:bg-slate-100" title="Sağa" onClick={() => nudge(-80, 0)}>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {sections.length === 0 ? (
        <p className="text-sm text-slate-600 bg-white rounded-lg border border-slate-200 px-3 py-4">
          Henüz bölüm yok. 2. adımda blok ekleyin.
        </p>
      ) : (
        <div
          ref={viewportRef}
          className="relative h-[min(70vh,640px)] w-full overflow-hidden rounded-lg border border-slate-300 bg-slate-100 cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div
            className="absolute left-0 top-0 origin-top-left will-change-transform"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <div className="flex flex-col gap-4 p-2 min-w-max">
              <div className="rounded-md bg-slate-800 text-white text-center text-sm py-3 tracking-[0.35em] font-medium min-w-[480px]">
                {draft.stageLabel || "SAHNE"}
              </div>

              {hasBalcony && (
                <div className="flex flex-row items-start gap-4 min-w-max">
                  <div className="flex flex-col gap-3">{byZone.balcony_left.map(renderSection)}</div>
                  <div className="flex flex-col gap-3">{byZone.balcony_rear.map(renderSection)}</div>
                  <div className="flex flex-col gap-3">{byZone.balcony_right.map(renderSection)}</div>
                </div>
              )}

              <div className="flex flex-row items-start gap-4 min-w-max">
                <div className="flex flex-col gap-3">{byZone.parkett_left.map(renderSection)}</div>
                <div className="flex flex-col gap-3">
                  {byZone.parkett_center.map(renderSection)}
                  {byZone.parkett_rear.map(renderSection)}
                </div>
                <div className="flex flex-col gap-3">{byZone.parkett_right.map(renderSection)}</div>
              </div>

              {sections.filter((s) => !ZONE_OPTIONS.some((z) => z.value === s.zone)).length > 0 && (
                <div className="flex flex-row gap-3 min-w-max">
                  {sections
                    .filter((s) => !ZONE_OPTIONS.some((z) => z.value === s.zone))
                    .map(renderSection)}
                </div>
              )}
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/50 text-white text-[10px] px-2 py-1">
            Sürükle = kaydır
          </div>
        </div>
      )}
    </div>
  );
}

function SectionMiniPreview({ section }: { section: Wizard2Section }) {
  const rows = buildSectionPreview(section);
  const bands = normalizeCategoryBands(section);
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-800">Canlı önizleme (kategori renkleri)</p>
        <p className="text-[10px] text-slate-500">{section.rowCount} sıra · {section.seatsPerRow} koltuk</p>
      </div>
      <p className="text-[11px] text-slate-600">
        {bands.map((b) => `${b.fromRow}–${b.toRow} ${b.category}`).join(" · ") || "Aralık yok"}
      </p>
      <div className="space-y-0.5 overflow-x-auto max-h-56 overflow-y-auto">
        {rows.map((row, ri) => {
          const category = categoryForRowIndex(section, ri);
          return (
            <div key={row.rowLabel} className="flex items-center gap-1 min-w-max">
              <span className="w-6 shrink-0 text-[10px] text-slate-500 tabular-nums">{row.rowLabel}</span>
              <span className="w-16 shrink-0 truncate text-[9px] text-slate-500" title={category}>
                {category}
              </span>
              {row.seats.map((s, i) => (
                <span
                  key={`${row.rowLabel}-${i}`}
                  title={`${row.rowLabel} · ${s.label} · ${category}`}
                  className={[
                    "h-5 min-w-[1.15rem] px-0.5 rounded-[3px] border text-[8px] font-medium flex items-center justify-center tabular-nums",
                    categorySeatClass(category, s.blocked),
                  ].join(" ")}
                >
                  {s.label}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BandEditor({
  section,
  onChange,
}: {
  section: Wizard2Section;
  onChange: (bands: CategoryBand[]) => void;
}) {
  const bands = normalizeCategoryBands(section);

  const update = (id: string, patch: Partial<CategoryBand>) => {
    onChange(bands.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const applyThreeBandPreset = () => {
    const n = Math.max(3, section.rowCount);
    const a = Math.max(1, Math.floor(n * 0.25));
    const b = Math.max(a + 1, Math.floor(n * 0.6));
    onChange([
      createBand(1, a, "VIP"),
      createBand(a + 1, b, "Kategori 1"),
      createBand(b + 1, n, "Kategori 2"),
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">Sıra aralığı → kategori</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyThreeBandPreset}
            className="text-xs px-2 py-1 rounded border border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
          >
            3 kategori örneği (VIP / Kat.1 / Kat.2)
          </button>
          <button
            type="button"
            onClick={() => onChange(appendCategoryBand(bands, section.rowCount, "Kategori 1"))}
            className="text-xs inline-flex items-center gap-1 text-teal-800 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Aralık ekle
          </button>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        Her aralığın ilk–son sıra numarasını ve kategorisini yaz. Örn. 1–3 VIP, 4–8 Kategori 1, 9–13 Kategori 2.
        Yeni aralık eklenince boş yer yoksa son aralık otomatik ikiye bölünür; önizleme renkleri hemen değişir.
      </p>
      <div className="space-y-2">
        {bands.map((b) => (
          <div
            key={b.id}
            className="grid grid-cols-[1fr_1fr_1.4fr_auto] gap-2 items-end rounded-lg border border-slate-200 p-2 bg-white"
          >
            <label className="text-xs text-slate-600 space-y-0.5">
              İlk sıra
              <input
                type="number"
                min={1}
                max={section.rowCount}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={b.fromRow}
                onChange={(e) => update(b.id, { fromRow: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label className="text-xs text-slate-600 space-y-0.5">
              Son sıra
              <input
                type="number"
                min={1}
                max={section.rowCount}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={b.toRow}
                onChange={(e) => update(b.id, { toRow: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label className="text-xs text-slate-600 space-y-0.5">
              Kategori
              <input
                list="w2-cat"
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={b.category}
                onChange={(e) => update(b.id, { category: e.target.value })}
              />
            </label>
            <button
              type="button"
              disabled={bands.length <= 1}
              onClick={() => onChange(bands.filter((x) => x.id !== b.id))}
              className="p-2 text-red-600 disabled:opacity-30"
              title="Sil"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <datalist id="w2-cat">
        {CATEGORY_PRESETS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}

export default function SalonWizard2Client() {
  const [step, setStep] = useState<StepId>(1);
  const [draft, setDraft] = useState<Wizard2Draft>(() => createDefaultDraft());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [venueId, setVenueId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exportResult, setExportResult] = useState<{
    planId: string;
    planName: string;
    venueId: string;
  } | null>(null);

  const selected = useMemo(
    () => draft.sections.find((s) => s.id === selectedId) ?? draft.sections[0] ?? null,
    [draft.sections, selectedId]
  );

  const stats = useMemo(() => countDraftSeats(draft), [draft]);
  const ticketPreview = useMemo(() => aggregateTicketPreview(draft), [draft]);

  useEffect(() => {
    if (!selectedId && draft.sections[0]) setSelectedId(draft.sections[0].id);
  }, [draft.sections, selectedId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("venues").select("id, name").order("name");
      setVenues((data as VenueOption[]) || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/salon-yapim-wizard-2/plan");
        const json = await res.json();
        if (json?.draft && Array.isArray(json.draft.sections)) {
          const d = json.draft as Wizard2Draft;
          const sections = d.sections.map((s) => normalizeSectionForPreview(s));
          setDraft({
            planName: d.planName || "Yeni salon planı",
            stageLabel: d.stageLabel || "SAHNE",
            ticketNamingMode: d.ticketNamingMode || "section_category",
            sections,
            savedAt: d.savedAt,
          });
          setSavedAt(json.savedAt ?? null);
          if (sections[0]?.id) setSelectedId(sections[0].id);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const updateSection = useCallback((id: string, patch: Partial<Wizard2Section>) => {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }, []);

  const addSection = (zone: SectionZone, name: string) => {
    // Sol/sağ konumunda isimde Sol/Sağ geçsin — oturum planı önizlemesi ve hizalama net olsun
    let finalName = name;
    if ((zone.includes("left") || zone.includes("right")) && !/sol|sağ|sag|left|right/i.test(name)) {
      finalName = zone.includes("left") ? `${name} Sol` : `${name} Sağ`;
    }
    const sec = createEmptySection({
      name: finalName,
      zone,
      rowCount: zone === "parkett_center" ? 13 : 8,
      seatsPerRow: zone === "parkett_center" ? 18 : 10,
      direction: zone.includes("left") ? "rtl" : "ltr",
      categoryBands:
        zone === "parkett_center"
          ? [createBand(1, 3, "VIP"), createBand(4, 8, "Kategori 1"), createBand(9, 13, "Kategori 2")]
          : [createBand(1, 1, "VIP"), createBand(2, 8, "Kategori 2")],
    });
    setDraft((d) => ({ ...d, sections: [...d.sections, sec] }));
    setSelectedId(sec.id);
  };

  const mirrorLeftToRight = () => {
    const left = draft.sections.find((s) => s.zone === "parkett_left" || s.zone === "balcony_left");
    if (!left) {
      setError("Önce sol blok ekleyin; sonra sağa kopyalanır.");
      return;
    }
    const rightZone: SectionZone = left.zone.startsWith("balcony") ? "balcony_right" : "parkett_right";
    const rightName = left.name
      .replace(/\bSol\b/gi, "Sağ")
      .replace(/\bleft\b/gi, "right");
    const copy: Wizard2Section = {
      ...left,
      id: crypto.randomUUID(),
      name: /sağ|sag|right/i.test(rightName) && rightName !== left.name ? rightName : `${left.name.replace(/\bSol\b/gi, "").trim()} Sağ`.replace(/\s+/g, " "),
      zone: rightZone,
      direction: left.direction === "ltr" ? "rtl" : "ltr",
      categoryBands: normalizeCategoryBands(left).map((b) => ({ ...b, id: crypto.randomUUID() })),
      salesBlockedKeys: [],
      aisleAfterRowNumbers: [...left.aisleAfterRowNumbers],
    };
    setDraft((d) => {
      const withoutRight = d.sections.filter((s) => s.zone !== rightZone);
      return { ...d, sections: [...withoutRight, copy] };
    });
    setSelectedId(copy.id);
    setError(null);
    setStatus("Sağ blok, solun kopyası olarak eklendi. İstersen ayrı düzenleyebilirsin.");
  };

  const saveDraft = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Oturum gerekli");
      const res = await fetch("/api/salon-yapim-wizard-2/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Kayıt başarısız");
      setSavedAt(json.savedAt ?? new Date().toISOString());
      setStatus("Taslak kaydedildi.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kayıt hatası");
    } finally {
      setBusy(false);
    }
  };

  const clearDraft = async () => {
    if (!confirm("Wizard 2 taslağı silinsin mi? Eski wizard değişmez.")) return;
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Oturum gerekli");
      await fetch("/api/salon-yapim-wizard-2/plan", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const fresh = createDefaultDraft();
      setDraft(fresh);
      setSelectedId(fresh.sections[0]?.id ?? null);
      setSavedAt(null);
      setExportResult(null);
      setStatus("Taslak temizlendi.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Silme hatası");
    } finally {
      setBusy(false);
    }
  };

  const exportToVenue = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    setExportResult(null);
    try {
      if (!venueId) throw new Error("Mekan seçin");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Oturum gerekli");
      const res = await fetch("/api/salon-yapim-wizard-2/to-venue", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ venueId, draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Aktarım başarısız");
      setExportResult({
        planId: json.seatingPlanId,
        planName: json.planName,
        venueId: json.venueId,
      });
      setStatus(`Aktarıldı: ${json.planName}. Yeni etkinlikte bu planı seç → bilet satırları otomatik dolar; fiyatı sen yaz.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aktarım hatası");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link href="/yonetim" className="mt-0.5 p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-5 h-5 text-teal-700" />
                <h1 className="text-lg font-semibold text-slate-900">Salon Wizard 2</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                  Basit düzen
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Sıra aralığına kategori ver → mekana aktar → etkinlikte sadece fiyat yaz.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/yonetim/salon-yapim-wizard" className="text-sm text-slate-600 hover:underline">
              Eski wizard
            </Link>
            <button
              type="button"
              onClick={saveDraft}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Taslak
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={[
                "shrink-0 px-3 py-2 rounded-lg border text-left min-w-[8rem]",
                step === s.id ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200 bg-white text-slate-600",
              ].join(" ")}
            >
              <p className="text-xs font-semibold">
                {s.id}. {s.title}
              </p>
              <p className="text-[11px] opacity-80">{s.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">{error}</div>}
        {status && <div className="rounded-lg border border-teal-200 bg-teal-50 text-teal-900 text-sm px-3 py-2">{status}</div>}
        {savedAt && <p className="text-xs text-slate-500">Son taslak: {new Date(savedAt).toLocaleString("tr-TR")}</p>}

        {step === 1 && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <label className="block space-y-1 text-sm">
                <span className="text-slate-600">Plan adı</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={draft.planName}
                  onChange={(e) => setDraft((d) => ({ ...d, planName: e.target.value }))}
                />
              </label>
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-800">Hazır örnek</p>
                {PRESET_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      const next = applyPreset(p.id, draft.planName);
                      setDraft(next);
                      setSelectedId(next.sections[0]?.id ?? null);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-teal-400 hover:bg-teal-50 text-sm"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm"
              >
                Düzeni kur <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 space-y-2">
              <p className="font-semibold text-slate-900">Akış</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Bloklara isim ver (Parkett, Balkon…)</li>
                <li>İlk 3 sıra VIP, sonraki 5 Kategori 1… diye yaz</li>
                <li>Sol bloğu sağa kopyala (istersen sağını değiştir)</li>
                <li>Mekana aktar</li>
                <li>Yeni etkinlikte planı seç → VIP 120 adet vb. hazır; sadece fiyat gir</li>
              </ol>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid lg:grid-cols-[240px_1fr] gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase">Blok ekle</p>
              {(
                [
                  ["parkett_center", "Parkett / Orta", "Parkett"],
                  ["parkett_left", "Sol blok", "Balkon"],
                  ["parkett_right", "Sağ blok", "Balkon"],
                  ["parkett_rear", "Arka", "Arka salon"],
                ] as const
              ).map(([zone, label, defaultName]) => (
                <button
                  key={zone}
                  type="button"
                  onClick={() => addSection(zone, defaultName)}
                  className="w-full text-left text-sm px-2 py-1.5 rounded border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
              <button
                type="button"
                onClick={mirrorLeftToRight}
                className="w-full text-left text-sm px-2 py-1.5 rounded border border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100"
              >
                Sol → sağ kopyala
              </button>
              <div className="border-t border-slate-100 pt-2 space-y-1">
                {draft.sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={[
                      "w-full text-left px-2 py-2 rounded-lg text-sm",
                      selected?.id === s.id ? "bg-teal-50 border border-teal-600" : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <p className="font-medium truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-500">{zoneLabel(s.zone)}</p>
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <h2 className="font-semibold text-slate-900">Blok: {selected.name}</h2>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const copy = {
                          ...selected,
                          id: crypto.randomUUID(),
                          name: `${selected.name} kopya`,
                          categoryBands: normalizeCategoryBands(selected).map((b) => ({
                            ...b,
                            id: crypto.randomUUID(),
                          })),
                        };
                        setDraft((d) => ({ ...d, sections: [...d.sections, copy] }));
                        setSelectedId(copy.id);
                      }}
                      className="text-sm px-2 py-1 border rounded inline-flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> Kopyala
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft((d) => {
                          const next = d.sections.filter((s) => s.id !== selected.id);
                          return { ...d, sections: next.length ? next : [createEmptySection()] };
                        });
                      }}
                      className="text-sm px-2 py-1 border border-red-200 text-red-700 rounded"
                    >
                      Sil
                    </button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="text-sm space-y-1">
                    <span className="text-slate-600">Bölüm adı (salonda görünür)</span>
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={selected.name}
                      onChange={(e) => updateSection(selected.id, { name: e.target.value })}
                      placeholder="Parkett, Balkon, Orta salon…"
                    />
                  </label>
                  <label className="text-sm space-y-1">
                    <span className="text-slate-600">Konum</span>
                    <select
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={selected.zone}
                      onChange={(e) => updateSection(selected.id, { zone: e.target.value as SectionZone })}
                    >
                      {ZONE_OPTIONS.map((z) => (
                        <option key={z.value} value={z.value}>
                          {z.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm space-y-1">
                    <span className="text-slate-600">Sıra sayısı</span>
                    <input
                      type="number"
                      min={1}
                      max={80}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={selected.rowCount}
                      onChange={(e) => {
                        const rowCount = Math.min(80, Math.max(1, Number(e.target.value) || 1));
                        updateSection(selected.id, { rowCount });
                      }}
                    />
                  </label>
                  <label className="text-sm space-y-1">
                    <span className="text-slate-600">Sıra başına koltuk</span>
                    <input
                      type="number"
                      min={1}
                      max={80}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      value={selected.seatsPerRow}
                      onChange={(e) =>
                        updateSection(selected.id, {
                          seatsPerRow: Math.min(80, Math.max(1, Number(e.target.value) || 1)),
                        })
                      }
                    />
                  </label>
                </div>

                <BandEditor
                  section={selected}
                  onChange={(categoryBands) => updateSection(selected.id, { categoryBands })}
                />

                <SectionMiniPreview section={selected} />

                <details
                  className="rounded-lg border border-slate-200 p-3 text-sm"
                  open={showAdvanced}
                  onToggle={(e) => setShowAdvanced((e.target as HTMLDetailsElement).open)}
                >
                  <summary className="cursor-pointer font-medium text-slate-700">Gelişmiş (yön / koridor)</summary>
                  <div className="mt-3 grid sm:grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-slate-600 text-xs">Numara yönü</span>
                      <select
                        className="w-full rounded border border-slate-300 px-2 py-1.5"
                        value={selected.direction}
                        onChange={(e) =>
                          updateSection(selected.id, { direction: e.target.value as "ltr" | "rtl" })
                        }
                      >
                        <option value="ltr">Soldan sağa</option>
                        <option value="rtl">Sağdan sola</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-600 text-xs">Koridor (koltuk indeksinden sonra, 0=yok)</span>
                      <input
                        type="number"
                        min={0}
                        className="w-full rounded border border-slate-300 px-2 py-1.5"
                        value={selected.aisleAfterSeatIndex ?? 0}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          updateSection(selected.id, { aisleAfterSeatIndex: v <= 0 ? null : v });
                        }}
                      />
                    </label>
                  </div>
                </details>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm"
                >
                  Özet / etkinlik görünümü <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <h2 className="font-semibold text-slate-900">Etkinlikte otomatik oluşacak bilet satırları</h2>
              <label className="block space-y-2 text-sm">
                <span className="text-slate-700 font-medium">Bilet adlandırma</span>
                <select
                  className="w-full max-w-xl rounded-lg border border-slate-300 px-3 py-2"
                  value={draft.ticketNamingMode || "section_category"}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      ticketNamingMode: e.target.value as TicketNamingMode,
                    }))
                  }
                >
                  <option value="section_category">
                    Bölüm + kategori (Parkett VIP, Balkon Kategori 2) — aynı isimli bloklar birleşir
                  </option>
                  <option value="category_only">
                    Sadece kategori (VIP, Kategori 1…) — tüm salonda VIP tek satırda toplanır
                  </option>
                </select>
              </label>
              <p className="text-xs text-slate-500">
                {stats.total} koltuk · {draft.sections.length} blok. Yeni etkinlikte bu planı seçince aşağıdaki adetler
                dolar; sen fiyat yazarsın.
              </p>
              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">Bilet adı</th>
                    <th className="text-right px-3 py-2">Adet</th>
                    <th className="text-left px-3 py-2">Bölümler</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketPreview.map((row) => (
                    <tr key={row.label} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">{row.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.seatCount}</td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{row.sectionNames.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <FullSalonPreview draft={draft} />
              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm"
              >
                Mekana aktar <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <FullSalonPreview draft={draft} />

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 max-w-xl">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Mekana aktar
              </h2>
              <p className="text-xs text-slate-500">
                Yukarıdaki önizleme salonun son hali. Doğruysa mekanı seçip ekle.
              </p>
              <label className="block space-y-1 text-sm">
                <span className="text-slate-600">Mekan</span>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value)}
                >
                  <option value="">Seçin…</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-sm text-slate-600 rounded-lg bg-slate-50 border border-slate-100 p-3 space-y-1">
                <p>
                  <strong>{draft.planName}</strong> — {ticketPreview.length} bilet türü, {stats.total} koltuk
                </p>
                <ul className="text-xs space-y-0.5 max-h-40 overflow-y-auto">
                  {ticketPreview.map((t) => (
                    <li key={t.label}>
                      {t.seatCount}× {t.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !venueId}
                  onClick={exportToVenue}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Mekana ekle
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveDraft}
                  className="px-4 py-2 rounded-lg border text-sm"
                >
                  Taslak kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-lg border text-sm text-slate-700"
                >
                  Düzeni düzelt
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={clearDraft}
                  className="px-4 py-2 rounded-lg border border-red-200 text-red-700 text-sm"
                >
                  Taslağı sil
                </button>
              </div>
              {exportResult && (
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm space-y-2">
                  <p>Plan eklendi. Şimdi: Etkinlikler → Yeni → bu mekan + planı seç → 3. adımda fiyatları yaz.</p>
                  <Link
                    href={`/yonetim/mekanlar/${exportResult.venueId}/oturum-plani`}
                    className="font-medium text-teal-900 underline"
                  >
                    Oturum planını aç →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
