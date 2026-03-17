"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, LayoutGrid, Building2 } from "lucide-react";
import OrganizerOrAdminGuard from "@/components/OrganizerOrAdminGuard";
import Plan2BlockDesigner from "./Plan2BlockDesigner";
import type { Block } from "./Plan2BlockDesigner";
import { supabase } from "@/lib/supabase-client";

const SALON_VIZOR_STORAGE_KEY = "salon-tasarim-vizor-plan";

function getDefaultPlan2Blocks(): Block[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "Orta salon",
      blockType: "centerFront",
      rows: [
        {
          id: crypto.randomUUID(),
          rowNumber: 1,
          totalSeats: 42,
          segments: [
            { id: crypto.randomUUID(), fromSeat: 1, toSeat: 11, category: "VIP" },
            { id: crypto.randomUUID(), fromSeat: 12, toSeat: 22, category: "Kategori 2" },
            { id: crypto.randomUUID(), fromSeat: 23, toSeat: 31, category: "Kategori 3" },
            { id: crypto.randomUUID(), fromSeat: 32, toSeat: 42, category: "Kategori 4" },
          ],
        },
      ],
    },
  ];
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    VIP: "bg-amber-500",
    "Kategori 1": "bg-rose-500",
    "Kategori 2": "bg-blue-500",
    "Kategori 3": "bg-emerald-500",
    "Kategori 4": "bg-cyan-500",
    "Kategori 5": "bg-fuchsia-500",
    "Kategori 6": "bg-lime-500",
  };
  return colors[category] ?? "bg-slate-400";
}

export default function SalonTasarimVizorClient() {
  const [plan2Blocks, setPlan2Blocks] = useState<Block[]>(getDefaultPlan2Blocks);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveToServerStatus, setSaveToServerStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [showExportModal, setShowExportModal] = useState(false);
  const [venues, setVenues] = useState<{ id: string; name: string; city: string | null }[]>([]);
  const [exportVenueId, setExportVenueId] = useState("");
  const [exportPlanName, setExportPlanName] = useState("Salon planı");
  const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [exportMessage, setExportMessage] = useState("");

  // Önce sunucudan planı yükle (canlıda aynı plan görünsün); yoksa tarayıcıdan
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/salon-vizor-plan");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { plan2Blocks?: Block[]; savedAt?: string | null };
        if (Array.isArray(data.plan2Blocks) && data.plan2Blocks.length > 0) {
          setPlan2Blocks(data.plan2Blocks);
          if (data.savedAt) setLastSavedAt(data.savedAt);
          return;
        }
      } catch {
        /* ignore */
      }
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(SALON_VIZOR_STORAGE_KEY) : null;
        if (!raw || cancelled) return;
        const data = JSON.parse(raw) as { plan2Blocks?: Block[]; savedAt?: string };
        if (Array.isArray(data.plan2Blocks) && data.plan2Blocks.length > 0) {
          setPlan2Blocks(data.plan2Blocks);
          if (data.savedAt) setLastSavedAt(data.savedAt);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function savePlan() {
    const payload = {
      plan2Blocks,
      savedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(SALON_VIZOR_STORAGE_KEY, JSON.stringify(payload));
      setLastSavedAt(payload.savedAt);
    } catch (e) {
      console.error(e);
    }
    setSaveToServerStatus("saving");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/salon-vizor-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (res.ok) setSaveToServerStatus("ok"); else setSaveToServerStatus("error");
    } catch {
      setSaveToServerStatus("error");
    }
  }

  function startNewPlan() {
    if (typeof window !== "undefined" && !confirm("Yeni plana başlansın mı? Mevcut blok tasarımı silinir.")) return;
    setPlan2Blocks(getDefaultPlan2Blocks());
    setLastSavedAt(null);
  }

  useEffect(() => {
    if (!showExportModal) return;
    (async () => {
      const { data } = await supabase.from("venues").select("id, name, city").order("name");
      setVenues((data as { id: string; name: string; city: string | null }[]) || []);
      if (!exportVenueId && data?.length) setExportVenueId(data[0].id);
    })();
  }, [showExportModal]);

  async function exportToVenue() {
    if (!exportVenueId || !exportPlanName.trim()) return;
    const blocksToSend = plan2Blocks.filter((b) => b.blockType !== "corridor");
    if (!blocksToSend.length) {
      setExportMessage("En az bir blok (koridor hariç) ekleyin.");
      return;
    }
    setExportStatus("loading");
    setExportMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/salon-vizor-to-venue", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          venueId: exportVenueId,
          planName: exportPlanName.trim(),
          plan2Blocks: blocksToSend,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setExportStatus("ok");
        setExportMessage(json.message || "Plan mekana eklendi.");
      } else {
        setExportStatus("error");
        setExportMessage(json.error || "Plan mekana eklenemedi.");
      }
    } catch {
      setExportStatus("error");
      setExportMessage("İstek gönderilemedi.");
    }
  }

  const hasExportableBlocks = plan2Blocks.some((b) => b.blockType && b.blockType !== "corridor");

  return (
    <OrganizerOrAdminGuard>
      <div className="p-6 md:p-8 w-full max-w-[1600px] mx-auto">
        <div className="mb-6 flex items-center gap-4 flex-wrap">
          <Link
            href="/yonetim/mekanlar"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Mekanlar
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <LayoutGrid className="h-7 w-7 text-primary-600" />
            Salon Tasarım Vizörü
          </h1>
          <p className="mt-1 text-slate-600">
            Blokları ekleyip sıra ve koltuk segmentlerini tanımlayın. Kaydet ile tarayıcıda saklanır.
          </p>
        </div>

        <Plan2BlockDesigner blocks={plan2Blocks} onBlocksChange={setPlan2Blocks} />

        {/* Plan 2 önizleme – sahne + bloklar görsel */}
        {plan2Blocks.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm mb-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary-600" />
              Plan 2 önizleme
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Kaydettiğiniz bloklar aşağıda sahne önünde görsel olarak gösterilir. Kaydet ile tarayıcıda saklanır.
            </p>
            <div className="flex flex-col items-center gap-6">
              <div className="w-full max-w-md py-2 px-4 rounded bg-slate-700 text-white text-center text-sm font-medium">
                SAHNE
              </div>
              <div className="w-full h-8" aria-hidden />
              {(() => {
                const getZone = (b: { blockType?: string }) => {
                  if (b.blockType === "leftHorizontal" || b.blockType === "leftVertical") return 0;
                  if (b.blockType === "centerFront" || b.blockType === "centerBack") return 1;
                  if (b.blockType === "rightHorizontal" || b.blockType === "rightVertical") return 2;
                  return 1;
                };
                let lastZone = 1;
                const withZone = plan2Blocks.map((b) => {
                  const zone = b.blockType === "corridor" ? lastZone : (lastZone = getZone(b));
                  return { block: b, zone };
                });
                const left = withZone.filter((x) => x.zone === 0).map((x) => x.block);
                const center = withZone.filter((x) => x.zone === 1).map((x) => x.block);
                const right = withZone.filter((x) => x.zone === 2).map((x) => x.block);
                const renderBlock = (block: Block) => {
                  const isCorridor = block.blockType === "corridor";
                  const isLeftVertical = block.blockType === "leftVertical";
                  const isRightVertical = block.blockType === "rightVertical";
                  const isDikeyBlok = isLeftVertical || isRightVertical;
                  if (isCorridor) {
                    return (
                      <div key={block.id} className="flex flex-col items-center gap-1 rounded-lg border-2 border-slate-400 bg-slate-200/80 p-4 min-w-[120px]">
                        <span className="text-xs font-medium text-slate-600 mb-1">
                          {block.name || "Koridor"}
                        </span>
                        <div className="w-24 h-12 rounded bg-slate-500/60 flex items-center justify-center" title="Yürüme koridoru">
                          <span className="text-[10px] font-medium text-white/90 uppercase tracking-wide">Koridor</span>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={block.id} className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-4 overflow-x-auto">
                      <span className="text-sm font-medium text-slate-700 mb-2">
                        {block.name || "(İsimsiz blok)"}
                      </span>
                      <div
                        className={
                          isDikeyBlok
                            ? "flex flex-row gap-0 flex-wrap min-w-max"
                            : "flex flex-col gap-1 min-w-max"
                        }
                      >
                        {(isLeftVertical ? block.rows.slice().reverse() : block.rows).map((row) => {
                          const seats: { num: number; category?: string }[] = [];
                          for (let i = 1; i <= row.totalSeats; i++) seats.push({ num: i });
                          row.segments.forEach((seg) => {
                            for (let n = seg.fromSeat; n <= seg.toSeat && n <= row.totalSeats; n++)
                              seats[n - 1].category = seg.category;
                          });
                          const rowLabel = (
                            <span
                              className="flex-shrink-0 w-4 text-center text-[10px] font-medium text-slate-500 tabular-nums"
                              title={`Sıra ${row.rowNumber}`}
                            >
                              {row.rowNumber}
                            </span>
                          );
                          const seatsDiv = (
                            <div
                              className={
                                isDikeyBlok
                                  ? "flex flex-col items-center gap-0.5"
                                  : "flex flex-nowrap justify-center gap-0.5"
                              }
                              style={
                                isDikeyBlok
                                  ? undefined
                                  : { width: row.totalSeats * 14 }
                              }
                            >
                              {seats.map((s) => {
                                  const color = s.category ? getCategoryColor(s.category) : "bg-slate-300";
                                  return (
                                    <div
                                      key={s.num}
                                      className={`rounded-full flex-shrink-0 ${color} border border-white/40 flex items-center justify-center text-white font-medium text-[9px]`}
                                      style={{ width: 12, height: 12 }}
                                      title={`${block.name || "Blok"} · Sıra ${row.rowNumber} · Koltuk ${s.num}${s.category ? ` · ${s.category}` : ""}`}
                                    >
                                      {s.num}
                                    </div>
                                  );
                                })}
                            </div>
                          );
                          return (
                            <div
                              key={row.id}
                              className={
                                isDikeyBlok
                                  ? "flex flex-col items-center gap-0.5 shrink-0"
                                  : "flex flex-nowrap items-center gap-1.5 shrink-0"
                              }
                              style={
                                isDikeyBlok
                                  ? { width: 14 * 2 + 24 }
                                  : { width: row.totalSeats * 14 + 28 }
                              }
                            >
                              {rowLabel}
                              {seatsDiv}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                };
                return (
                  <div className="w-full overflow-x-auto">
                    <div className="flex flex-row justify-center gap-6 min-w-[1280px]">
                      <div className="flex flex-wrap gap-4 justify-end items-start w-[280px] shrink-0">
                        {left.map((block) => renderBlock(block))}
                      </div>
                      <div className="flex flex-wrap gap-4 justify-center items-start flex-1 min-w-[640px] shrink-0">
                        {center.map((block) => renderBlock(block))}
                      </div>
                      <div className="flex flex-wrap gap-4 justify-start items-start w-[280px] shrink-0">
                        {right.map((block) => renderBlock(block))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-xl border-2 border-primary-200 bg-primary-50/50 p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-medium text-slate-800">Planı kaydedin</p>
            <p className="text-sm text-slate-600 mt-0.5">
              Kaydettiğiniz plan hem tarayıcıda hem (admin iseniz) sunucuda saklanır; canlı sitede de aynı plan açılır.
              {lastSavedAt && (
                <span className="block mt-1 text-xs text-slate-500">
                  Son kayıt: {new Date(lastSavedAt).toLocaleString("tr-TR")}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={savePlan}
              disabled={saveToServerStatus === "saving"}
              className="px-6 py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 shadow-sm disabled:opacity-70"
            >
              {saveToServerStatus === "saving" ? "Kaydediliyor…" : "Kaydet"}
            </button>
            {saveToServerStatus === "ok" && <span className="text-sm text-green-600">Sunucuya kaydedildi</span>}
            {saveToServerStatus === "error" && <span className="text-sm text-amber-600">Tarayıcıda kaydedildi; sunucuya yazılamadı</span>}
            <button
              type="button"
              onClick={startNewPlan}
              className="px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50"
            >
              Yeni plan
            </button>
            {hasExportableBlocks && (
              <button
                type="button"
                onClick={() => { setShowExportModal(true); setExportStatus("idle"); setExportMessage(""); }}
                className="px-4 py-3 rounded-lg border border-emerald-600 bg-emerald-50 text-emerald-800 font-medium hover:bg-emerald-100 flex items-center gap-2"
              >
                <Building2 className="h-4 w-4" />
                Bu planı mekana aktar
              </button>
            )}
          </div>
        </div>

        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { if (exportStatus !== "loading") setShowExportModal(false); }}>
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Planı mekana aktar</h3>
              <p className="text-sm text-slate-600 mb-4">
                Bu tasarım seçtiğiniz mekanın oturum planı olarak eklenecek. Etkinlik oluştururken bu mekanı ve planı seçebilirsiniz.
              </p>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mekan</label>
                  <select
                    value={exportVenueId}
                    onChange={(e) => setExportVenueId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="">— Mekan seçin —</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}{v.city ? ` (${v.city})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Plan adı</label>
                  <input
                    type="text"
                    value={exportPlanName}
                    onChange={(e) => setExportPlanName(e.target.value)}
                    placeholder="Örn: Ana salon"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              {exportMessage && (
                <p className={`text-sm mb-4 ${exportStatus === "ok" ? "text-green-600" : "text-amber-600"}`}>
                  {exportMessage}
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  disabled={exportStatus === "loading"}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Kapat
                </button>
                <button
                  type="button"
                  onClick={exportToVenue}
                  disabled={exportStatus === "loading" || !exportVenueId || !exportPlanName.trim()}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                  {exportStatus === "loading" ? "Ekleniyor…" : "Mekana aktar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </OrganizerOrAdminGuard>
  );
}
