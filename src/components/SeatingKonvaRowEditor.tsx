"use client";

import { useCallback, useEffect, useState } from "react";
import { Stage, Layer, Group, Circle, Text } from "react-konva";
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

export default function SeatingKonvaRowEditor({ rowId, rowLabel, seats, onSeatsDraftChange }: SeatingKonvaRowEditorProps) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sorted = sortSeatsForGrid(seats);
    const next: Record<string, { x: number; y: number }> = {};
    sorted.forEach((s, i) => {
      const hasStored =
        s.x != null &&
        s.y != null &&
        !Number.isNaN(Number(s.x)) &&
        !Number.isNaN(Number(s.y));
      next[s.id] = hasStored
        ? { x: Number(s.x), y: Number(s.y) }
        : gridPosition(i, STAGE_H);
    });
    setPositions(next);
  }, [rowId, seats]);

  const emitDraftSeats = useCallback(
    (nextPos: Record<string, { x: number; y: number }>) => {
      const nextSeats = seats.map((s) => {
        const p = nextPos[s.id];
        if (!p) return s;
        return {
          ...s,
          x: Math.round(p.x * 10000) / 10000,
          y: Math.round(p.y * 10000) / 10000,
        };
      });
      onSeatsDraftChange?.(nextSeats);
    },
    [onSeatsDraftChange, seats]
  );

  const handleApplyGrid = async () => {
    const sorted = sortSeatsForGrid(seats);
    if (sorted.length === 0) return;
    setSaving(true);
    try {
      const nextPos: Record<string, { x: number; y: number }> = {};
      for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        nextPos[s.id] = gridPosition(i, STAGE_H);
      }
      setPositions((prev) => {
        const merged = { ...prev, ...nextPos };
        queueMicrotask(() => emitDraftSeats(merged));
        return merged;
      });
    } finally {
      setSaving(false);
    }
  };

  if (seats.length === 0) {
    return <p className="text-xs text-slate-500">Bu sırada koltuk yok; önce koltuk numaraları ekleyin.</p>;
  }

  const sorted = sortSeatsForGrid(seats);
  const stageW = rowEditorStageWidth(sorted.length);

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
        <Stage width={stageW} height={STAGE_H}>
          <Layer>
            {sorted.map((s) => {
              const pos = positions[s.id] ?? gridPosition(0, STAGE_H);
              const lbl = String(s.seat_label);
              const tw = Math.max(lbl.length * 8, 18);
              return (
                <Group
                  key={s.id}
                  x={pos.x}
                  y={pos.y}
                  draggable
                  dragBoundFunc={(p) => ({
                    x: Math.min(stageW - R, Math.max(R, p.x)),
                    y: Math.min(STAGE_H - R, Math.max(R, p.y)),
                  })}
                  onDragEnd={(e) => {
                    const nx = e.target.x();
                    const ny = e.target.y();
                    setPositions((prev) => {
                      const next = { ...prev, [s.id]: { x: nx, y: ny } };
                      queueMicrotask(() => emitDraftSeats(next));
                      return next;
                    });
                  }}
                >
                  <Circle
                    radius={R}
                    fill={s.sales_blocked ? "#fde68a" : "#e2e8f0"}
                    stroke={s.sales_blocked ? "#b45309" : "#64748b"}
                    strokeWidth={1.5}
                  />
                  <Text
                    text={lbl}
                    fontSize={10}
                    fill="#1e293b"
                    fontStyle="bold"
                    x={-tw / 2}
                    y={-5}
                    width={tw}
                    align="center"
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
