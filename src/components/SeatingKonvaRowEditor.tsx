"use client";

import { useCallback, useEffect, useState } from "react";
import { Stage, Layer, Group, Circle, Text } from "react-konva";
import { supabase } from "@/lib/supabase-client";
import type { Seat } from "@/types/database";

const STAGE_W = 900;
const STAGE_H = 240;
const R = 16;
const GAP = 38;

function sortSeatsForGrid(seats: Seat[]) {
  return [...seats].sort((a, b) => {
    const na = parseInt(String(a.seat_label), 10);
    const nb = parseInt(String(b.seat_label), 10);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(a.seat_label).localeCompare(String(b.seat_label), undefined, { numeric: true });
  });
}

function gridPosition(index: number) {
  return { x: 32 + R + index * GAP, y: STAGE_H / 2 };
}

export type SeatingKonvaRowEditorProps = {
  rowId: string;
  rowLabel: string;
  seats: Seat[];
  onSaved?: () => void;
};

export default function SeatingKonvaRowEditor({ rowId, rowLabel, seats, onSaved }: SeatingKonvaRowEditorProps) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [saving, setSaving] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

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
        : gridPosition(i);
    });
    setPositions(next);
  }, [rowId, seats]);

  const persistSeat = useCallback(
    async (seatId: string, x: number, y: number) => {
      setLastError(null);
      const { error } = await supabase
        .from("seats")
        .update({
          x: Math.round(x * 10000) / 10000,
          y: Math.round(y * 10000) / 10000,
        })
        .eq("id", seatId);
      if (error) {
        setLastError(error.message);
        return false;
      }
      onSaved?.();
      return true;
    },
    [onSaved]
  );

  const handleApplyGrid = async () => {
    const sorted = sortSeatsForGrid(seats);
    if (sorted.length === 0) return;
    setSaving(true);
    setLastError(null);
    try {
      const nextPos: Record<string, { x: number; y: number }> = {};
      for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i];
        const p = gridPosition(i);
        nextPos[s.id] = p;
        const { error } = await supabase
          .from("seats")
          .update({ x: p.x, y: p.y })
          .eq("id", s.id);
        if (error) {
          setLastError(error.message);
          return;
        }
      }
      setPositions((prev) => ({ ...prev, ...nextPos }));
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  if (seats.length === 0) {
    return <p className="text-xs text-slate-500">Bu sırada koltuk yok; önce koltuk numaraları ekleyin.</p>;
  }

  const sorted = sortSeatsForGrid(seats);

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-xs text-slate-600">
          Sıra <strong>{rowLabel}</strong>: koltukları sürükleyin; konum otomatik kaydedilir. İlk kez düzenliyorsanız &quot;Grid yerleştir&quot; ile hizalayın.
        </p>
        <button
          type="button"
          onClick={handleApplyGrid}
          disabled={saving}
          className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {saving ? "Kaydediliyor…" : "Grid yerleştir ve kaydet"}
        </button>
      </div>
      {lastError && <p className="text-xs text-red-600 mb-2">{lastError}</p>}
      <div className="rounded-md border border-slate-300 bg-white overflow-x-auto">
        <Stage width={STAGE_W} height={STAGE_H}>
          <Layer>
            {sorted.map((s) => {
              const pos = positions[s.id] ?? gridPosition(0);
              const lbl = String(s.seat_label);
              const tw = Math.max(lbl.length * 8, 18);
              return (
                <Group
                  key={s.id}
                  x={pos.x}
                  y={pos.y}
                  draggable
                  dragBoundFunc={(p) => ({
                    x: Math.min(STAGE_W - R, Math.max(R, p.x)),
                    y: Math.min(STAGE_H - R, Math.max(R, p.y)),
                  })}
                  onDragEnd={(e) => {
                    const nx = e.target.x();
                    const ny = e.target.y();
                    setPositions((prev) => ({ ...prev, [s.id]: { x: nx, y: ny } }));
                    void persistSeat(s.id, nx, ny);
                  }}
                >
                  <Circle radius={R} fill="#e2e8f0" stroke="#64748b" strokeWidth={1.5} />
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
