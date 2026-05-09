"use client";

import { useEffect, useRef, useState } from "react";
import Konva from "konva";
import type { Seat } from "@/types/database";
import {
  ROW_EDITOR_GAP as GAP,
  ROW_EDITOR_PAD_X as STAGE_PAD_X,
  ROW_EDITOR_R as R,
  ROW_EDITOR_STAGE_H as STAGE_H,
  rowEditorStageWidth,
} from "@/lib/seating-plans/row-editor-grid";

function sortSeatsForGrid(seats: Seat[]) {
  return [...seats].sort((a, b) => {
    const na = parseInt(String(a.seat_label), 10);
    const nb = parseInt(String(b.seat_label), 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.seat_label).localeCompare(String(b.seat_label), undefined, { numeric: true });
  });
}

function gridPosition(index: number, stageH: number) {
  return { x: STAGE_PAD_X + R + index * GAP, y: stageH / 2 };
}

export type SeatingKonvaRowEditorProps = {
  rowId: string;
  rowLabel: string;
  seats: Seat[];
  onSeatsDraftChange?: (nextSeats: Seat[]) => void;
};

/** react-konva kullanılmıyor (çift React / ReactCurrentOwner); yalnızca konva imperatif API. */
export default function SeatingKonvaRowEditor({
  rowId,
  rowLabel,
  seats,
  onSeatsDraftChange,
}: SeatingKonvaRowEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const seatsRef = useRef(seats);
  seatsRef.current = seats;

  const [saving, setSaving] = useState(false);

  const onDraftRef = useRef(onSeatsDraftChange);
  onDraftRef.current = onSeatsDraftChange;

  function emitRoundedSeats(nextSeats: Seat[]) {
    const rounded = nextSeats.map((s) => ({
      ...s,
      x: s.x != null ? Math.round(Number(s.x) * 10000) / 10000 : null,
      y: s.y != null ? Math.round(Number(s.y) * 10000) / 10000 : null,
    }));
    onDraftRef.current?.(rounded);
  }

  const handleApplyGrid = () => {
    const sorted = sortSeatsForGrid(seatsRef.current);
    if (sorted.length === 0) return;
    setSaving(true);
    try {
      const nextSeats = sorted.map((s, i) => {
        const p = gridPosition(i, STAGE_H);
        return { ...s, x: p.x, y: p.y };
      });
      emitRoundedSeats(nextSeats);
    } finally {
      setSaving(false);
    }
  };

  const seatsKey = JSON.stringify(
    sortSeatsForGrid(seats).map((s) => ({
      id: s.id,
      x: s.x,
      y: s.y,
      seat_label: s.seat_label,
      sales_blocked: s.sales_blocked === true,
    }))
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || seats.length === 0) {
      stageRef.current?.destroy();
      stageRef.current = null;
      if (el && "replaceChildren" in el) el.replaceChildren();
      else if (el) {
        const box = el as HTMLElement;
        while (box.firstChild) box.removeChild(box.firstChild);
      }
      return;
    }

    const sorted = sortSeatsForGrid(seats);
    const stageW = rowEditorStageWidth(sorted.length);

    stageRef.current?.destroy();
    stageRef.current = null;
    if ("replaceChildren" in el) el.replaceChildren();
    else {
      const box = el as HTMLElement;
      while (box.firstChild) box.removeChild(box.firstChild);
    }

    const stage = new Konva.Stage({
      container: el,
      width: stageW,
      height: STAGE_H,
    });
    stageRef.current = stage;

    const layer = new Konva.Layer();
    stage.add(layer);

    sorted.forEach((s, i) => {
      const hasStored =
        s.x != null &&
        s.y != null &&
        !Number.isNaN(Number(s.x)) &&
        !Number.isNaN(Number(s.y));
      const pos = hasStored ? { x: Number(s.x), y: Number(s.y) } : gridPosition(i, STAGE_H);

      const lbl = String(s.seat_label);
      const tw = Math.max(lbl.length * 8, 18);

      const group = new Konva.Group({
        x: pos.x,
        y: pos.y,
        draggable: true,
        dragBoundFunc: (p) => ({
          x: Math.min(stageW - R, Math.max(R, p.x)),
          y: Math.min(STAGE_H - R, Math.max(R, p.y)),
        }),
      });

      group.add(
        new Konva.Circle({
          radius: R,
          fill: s.sales_blocked ? "#fde68a" : "#e2e8f0",
          stroke: s.sales_blocked ? "#b45309" : "#64748b",
          strokeWidth: 1.5,
        })
      );
      group.add(
        new Konva.Text({
          text: lbl,
          fontSize: 10,
          fill: "#1e293b",
          fontStyle: "bold",
          x: -tw / 2,
          y: -5,
          width: tw,
          align: "center",
        })
      );

      group.on("dragend", () => {
        const nx = group.x();
        const ny = group.y();
        const cur = seatsRef.current;
        const nextSeats = cur.map((seat) =>
          seat.id === s.id ? { ...seat, x: nx, y: ny } : seat
        );
        queueMicrotask(() => emitRoundedSeats(nextSeats));
      });

      layer.add(group);
    });

    layer.draw();

    return () => {
      stage.destroy();
      stageRef.current = null;
    };
  }, [rowId, seatsKey, seats.length]);

  if (seats.length === 0) {
    return <p className="text-xs text-slate-500">Bu sırada koltuk yok; önce koltuk numaraları ekleyin.</p>;
  }

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50/90 p-2">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <p className="text-[11px] text-slate-600 leading-snug flex-1 min-w-[12rem]">
          <strong>Sıra {rowLabel}</strong>: koltukları sürükleyin (taslak). Kayıt: <strong>Salonu Kaydet</strong>.
        </p>
        <button
          type="button"
          onClick={handleApplyGrid}
          disabled={saving}
          title="Koltukları eşit aralıklı tek yatay sıraya hizalar; konumlar taslağa yazılır."
          className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {saving ? "…" : "Sıraya hizala"}
        </button>
      </div>
      <div className="rounded border border-slate-300 bg-white overflow-x-auto max-w-full">
        <div ref={containerRef} className="konva-row-editor-canvas" />
      </div>
    </div>
  );
}
