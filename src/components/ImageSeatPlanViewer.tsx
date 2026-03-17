"use client";

import { useRef, useState, useCallback } from "react";
import type { GetSeatCoordFn } from "@/lib/seating-plans/image-plan-types";

export type ImageSeatItem = {
  id: string;
  section_name: string;
  row_label: string;
  seat_label: string;
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
  onSeatToggle: (seatId: string) => void;
}

export default function ImageSeatPlanViewer({
  imageUrl,
  seats,
  getCoord,
  selectedSeatIds,
  soldSeatIds,
  onSeatToggle,
}: ImageSeatPlanViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.9);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const didMove = useRef(false);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale((s) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s + delta)));
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
      const coord = getCoord(seat.section_name, seat.row_label, seat.seat_label);
      return coord ? { ...seat, x: coord.x, y: coord.y } : null;
    })
    .filter((s): s is ImageSeatItem & { x: number; y: number } => s !== null);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-slate-600">Salon planı (görsel):</span>
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
          Fare tekerleği ile zoom · Sürükleyerek hareket ettirin · Koltuklara tıklayın
        </span>
      </div>
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 touch-none relative"
        style={{ minHeight: 420, maxHeight: "70vh", cursor: isDragging ? "grabbing" : "grab" }}
        onWheel={handleWheel}
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
            width: "fit-content",
            position: "relative",
            display: "inline-block",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={imageUrl}
            alt="Salon planı"
            className="block max-w-none h-auto pointer-events-none select-none"
            style={{ minWidth: 600, width: "min(100vw, 900px)" }}
            draggable={false}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            aria-hidden
          >
            {seatsWithCoord.map((seat) => {
              const selected = selectedSeatIds.has(seat.id);
              const sold = soldSeatIds.has(seat.id);
              const leftPct = seat.x * 100;
              const topPct = seat.y * 100;
              return (
                <button
                  key={seat.id}
                  type="button"
                  className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow pointer-events-auto cursor-pointer transition-colors"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    backgroundColor: sold
                      ? "#475569"
                      : selected
                        ? "#22c55e"
                        : "#94a3b8",
                  }}
                  disabled={sold}
                  onClick={() => handleSeatClick(seat.id)}
                  title={sold ? `${seat.section_name} ${seat.row_label}/${seat.seat_label} (satıldı)` : `${seat.section_name} Sıra ${seat.row_label} Nr ${seat.seat_label}`}
                  aria-pressed={selected}
                  aria-disabled={sold}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
