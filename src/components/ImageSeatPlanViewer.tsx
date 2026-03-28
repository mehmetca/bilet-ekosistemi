"use client";

import { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import type { GetSeatCoordFn, ImagePlanSectionGrid } from "@/lib/seating-plans/image-plan-types";

export type ImageSeatItem = {
  id: string;
  section_name: string;
  row_label: string;
  seat_label: string;
  /** theaterduisburg: önceden hesaplanmış konum (etiket uyumsuzluğunda da dolu) */
  x?: number;
  y?: number;
  /** Salonda plaka numarası (daire içinde gösterilir) */
  venue_plate?: number;
  /** tooltip / erişilebilirlik */
  venue_caption?: string;
  /** 1. PARKETT: SVG’deki rakam metni */
  seat_display_label?: string;
};

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.2;

interface ImageSeatPlanViewerProps {
  imageUrl: string;
  seats: ImageSeatItem[];
  getCoord: GetSeatCoordFn;
  selectedSeatIds: Set<string>;
  soldSeatIds: Set<string>;
  /** Satışa kapalı koltuklar (satılmış gibi tıklanamaz; görsel olarak ayrılır) */
  blockedSeatIds?: Set<string>;
  onSeatToggle: (seatId: string) => void;
  /** `?seatDebug=1` (etkinlik sayfası URL’si): grid bölgelerini kırmızı çerçeveyle gösterir */
  planSections?: ImagePlanSectionGrid[];
  showSeatGridDebug?: boolean;
  /**
   * Kaynak görselin en/boy oranı (örn. SVG viewBox genişlik/yükseklik).
   * Verilirse kutu viewBox ile aynı oranda tutulur; % koordinatlar kaymaz.
   */
  imageAspectRatio?: number;
  /** Görsel viewBox genişliği (SVG ile aynı — koltuk dairesi px hesabı) */
  viewBoxWidth?: number;
  /** viewBox biriminde koltuk çapı (~8–9); gerçek taş boyutuna yakın */
  seatDiameterViewUnits?: number;
}

export default function ImageSeatPlanViewer({
  imageUrl,
  seats,
  getCoord,
  selectedSeatIds,
  soldSeatIds,
  blockedSeatIds,
  onSeatToggle,
  planSections,
  showSeatGridDebug = false,
  imageAspectRatio,
  viewBoxWidth = 1207.56,
  seatDiameterViewUnits = 8.5,
}: ImageSeatPlanViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const aspectBoxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  /** object-contain ile görsel kutudan küçükse: gerçek çizim alanı (viewBox ile hizalı %). */
  const [fitBox, setFitBox] = useState({ ox: 0, oy: 0, sx: 1, sy: 1 });
  /** object-contain ile çizilen görsel genişliği (px) — koltuk dairesi ölçeği */
  const [drawnImgWPx, setDrawnImgWPx] = useState(0);
  const [scale, setScale] = useState(0.9);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const didMove = useRef(false);

  const recalcImageFit = useCallback(() => {
    const box = aspectBoxRef.current;
    const img = imgRef.current;
    if (!box || !img?.naturalWidth) return;
    const W = box.clientWidth;
    const H = box.clientHeight;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (W <= 0 || H <= 0 || nw <= 0 || nh <= 0) return;
    const scaleFit = Math.min(W / nw, H / nh);
    const dw = nw * scaleFit;
    const dh = nh * scaleFit;
    setFitBox({
      ox: (W - dw) / 2 / W,
      oy: (H - dh) / 2 / H,
      sx: dw / W,
      sy: dh / H,
    });
  }, []);

  useLayoutEffect(() => {
    if (imageAspectRatio == null) return;
    const el = aspectBoxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recalcImageFit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [imageAspectRatio, recalcImageFit, imageUrl]);

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

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleSeatClick = useCallback((seatId: string) => {
    if (didMove.current) return;
    onSeatToggle(seatId);
  }, [onSeatToggle]);

  const zoomIn = () => setScale((s) => Math.min(MAX_ZOOM, s + ZOOM_STEP));
  const zoomOut = () => setScale((s) => Math.max(MIN_ZOOM, s - ZOOM_STEP));
  const resetView = () => { setScale(0.9); setPan({ x: 0, y: 0 }); };

  const seatsWithCoord = seats
    .map((seat) => {
      if (typeof seat.x === "number" && typeof seat.y === "number") {
        return { ...seat, x: seat.x, y: seat.y };
      }
      const coord = getCoord(seat.section_name, seat.row_label, seat.seat_label);
      return coord ? { ...seat, x: coord.x, y: coord.y } : null;
    })
    .filter((s): s is ImageSeatItem & { x: number; y: number } => s !== null);

  const mapNormToOverlayPct = useCallback(
    (nx: number, ny: number) => ({
      leftPct: (fitBox.ox + nx * fitBox.sx) * 100,
      topPct: (fitBox.oy + ny * fitBox.sy) * 100,
    }),
    [fitBox]
  );

  const overlayInner = (
    <>
      {showSeatGridDebug &&
        planSections?.map((sec, i) => {
          const tl = mapNormToOverlayPct(sec.x, sec.y);
          const br = mapNormToOverlayPct(sec.x + sec.width, sec.y + sec.height);
          return (
          <div
            key={`dbg-${sec.name}-${i}`}
            className="absolute z-[5] border-2 border-dashed border-red-500/90 bg-red-500/[0.08]"
            style={{
              left: `${tl.leftPct}%`,
              top: `${tl.topPct}%`,
              width: `${br.leftPct - tl.leftPct}%`,
              height: `${br.topPct - tl.topPct}%`,
            }}
            title={sec.name}
          >
            <span className="inline-block max-w-full truncate bg-white/90 px-0.5 text-[9px] font-bold leading-tight text-red-800">
              {sec.name}
            </span>
          </div>
          );
        })}
      {seatsWithCoord.map((seat) => {
        const selected = selectedSeatIds.has(seat.id);
        const sold = soldSeatIds.has(seat.id);
        const blocked = blockedSeatIds?.has(seat.id) ?? false;
        const { leftPct, topPct } = mapNormToOverlayPct(seat.x, seat.y);
        const svgLbl = seat.seat_display_label;
        const plate =
          svgLbl != null && svgLbl !== ""
            ? svgLbl
            : typeof seat.venue_plate === "number" && seat.venue_plate > 0
              ? String(seat.venue_plate)
              : seat.seat_label;
        const tip =
          seat.venue_caption ??
          `${seat.section_name} Sıra ${seat.row_label} Nr ${seat.seat_label}`;
        const dPx =
          drawnImgWPx > 0 && viewBoxWidth > 0
            ? Math.max(7, (seatDiameterViewUnits / viewBoxWidth) * drawnImgWPx)
            : 12;
        const fontPx = Math.max(5, Math.min(10, Math.round(dPx * 0.45)));
        return (
          <button
            key={seat.id}
            type="button"
            className={
              "absolute z-10 flex items-center justify-center rounded-full pointer-events-auto touch-manipulation transition-all duration-150 -translate-x-1/2 -translate-y-1/2 p-0 leading-none overflow-hidden " +
              (sold
                ? "cursor-not-allowed bg-slate-300 text-slate-800 ring-0 shadow-none"
                : blocked
                  ? "cursor-not-allowed bg-amber-200 text-amber-950 ring-1 ring-amber-500"
                : selected
                  ? "cursor-pointer bg-[#39ff14] text-slate-900 ring-0 shadow-none border-0"
                  : "cursor-pointer bg-sky-200 text-slate-800 ring-0 shadow-sm border-0 hover:!bg-[#39ff14] hover:!text-slate-900 focus-visible:outline-none focus-visible:ring-0")
            }
            style={{
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: dPx,
              height: dPx,
              fontSize: fontPx,
            }}
            disabled={sold || blocked}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handleSeatClick(seat.id)}
            title={sold ? `${tip} (satıldı)` : blocked ? `${tip} (satışa kapalı)` : tip}
            aria-pressed={selected}
            aria-disabled={sold || blocked}
            aria-label={tip}
          >
            <span className="font-bold tabular-nums">{plate}</span>
          </button>
        );
      })}
    </>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-600">Salon planı</span>
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
          Zoom: tekerlek · Gezdirme: boş alandan sürükleyin · Koltuk: açık renkli noktalara tıklayın (satılmış: koyu)
        </span>
      </div>
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-slate-200 bg-white touch-none relative"
        style={{ minHeight: 520, maxHeight: "min(82vh, 920px)", cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        onMouseUp={handleMouseUp}
        role="application"
        aria-label="Salon planı görseli; koltuklara tıklayarak seçin"
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            width: imageAspectRatio != null ? "100%" : "fit-content",
            position: "relative",
            display: imageAspectRatio != null ? "block" : "inline-block",
            lineHeight: 0,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {imageAspectRatio != null ? (
            <div
              ref={aspectBoxRef}
              className="relative w-full max-w-[920px] overflow-hidden rounded-md shadow-sm ring-1 ring-slate-200/90"
              style={{ aspectRatio: imageAspectRatio }}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Salon planı"
                className="absolute inset-0 block h-full w-full object-contain bg-white pointer-events-none select-none"
                draggable={false}
                decoding="async"
                onLoad={recalcImageFit}
              />
              <div className="absolute inset-0 pointer-events-none" aria-hidden>
                {overlayInner}
              </div>
            </div>
          ) : (
            <div className="relative inline-block max-w-full overflow-hidden rounded-md shadow-sm ring-1 ring-slate-200/90">
              <img
                src={imageUrl}
                alt="Salon planı"
                className="block h-auto max-h-[min(82vh,960px)] w-auto max-w-[min(100vw,920px)] min-w-[min(100%,560px)] pointer-events-none select-none"
                draggable={false}
                decoding="async"
              />
              <div className="absolute inset-0 pointer-events-none" aria-hidden>
                {overlayInner}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
