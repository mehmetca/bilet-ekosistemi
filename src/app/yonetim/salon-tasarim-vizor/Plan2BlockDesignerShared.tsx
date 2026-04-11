"use client";

import React from "react";

export const SEAT_SIZE = 16;
export const SEAT_GAP = 3;

export type SeatSegment = {
  id: string;
  fromSeat: number;
  toSeat: number;
  category: string;
};

export type BlockRow = {
  id: string;
  rowNumber: number;
  totalSeats: number;
  segments: SeatSegment[];
};

export type BlockType =
  | "centerFront"
  | "centerBack"
  | "rightHorizontal"
  | "rightVertical"
  | "leftHorizontal"
  | "leftVertical"
  | "corridor";

export type Block = {
  id: string;
  name: string;
  rows: BlockRow[];
  blockType?: BlockType;
};

export type BlockOrientation = "horizontal" | "vertical";

export const BLOCK_TYPE_OPTIONS: { value: BlockType; label: string; group: string }[] = [
  { value: "centerFront", label: "Orta blok (sahne önü)", group: "Orta blok" },
  { value: "centerBack", label: "Orta blok (sahne arkası)", group: "Orta blok" },
  { value: "leftHorizontal", label: "Sol blok (yatay)", group: "Sol blok" },
  { value: "leftVertical", label: "Sol blok (dikey)", group: "Sol blok" },
  { value: "rightHorizontal", label: "Sağ blok (yatay)", group: "Sağ blok" },
  { value: "rightVertical", label: "Sağ blok (dikey)", group: "Sağ blok" },
  { value: "corridor", label: "Koridor", group: "Koridor" },
];

export const CATEGORY_OPTIONS = [
  "VIP",
  "Kategori 1",
  "Kategori 2",
  "Kategori 3",
  "Kategori 4",
  "Kategori 5",
  "Kategori 6",
  "Kategori 7",
  "Kategori 8",
  "Kategori 9",
  "Kategori 10",
];

function getCategoryColor(cat: string): string {
  switch (cat) {
    case "VIP":
      return "bg-amber-500";
    case "Kategori 1":
      return "bg-rose-500";
    case "Kategori 2":
      return "bg-blue-500";
    case "Kategori 3":
      return "bg-emerald-500";
    case "Kategori 4":
      return "bg-cyan-500";
    case "Kategori 5":
      return "bg-fuchsia-500";
    case "Kategori 6":
      return "bg-lime-500";
    default:
      return "bg-slate-400";
  }
}

export function normalizeSegments(totalSeats: number, segments: SeatSegment[]): SeatSegment[] {
  const cleaned = segments
    .map((s) => ({
      ...s,
      fromSeat: Math.max(1, Math.min(totalSeats, Math.floor(s.fromSeat || 1))),
      toSeat: Math.max(1, Math.min(totalSeats, Math.floor(s.toSeat || 1))),
    }))
    .map((s) => {
      if (s.fromSeat > s.toSeat) {
        return { ...s, fromSeat: s.toSeat, toSeat: s.fromSeat };
      }
      return s;
    })
    .sort((a, b) => a.fromSeat - b.fromSeat);

  const result: SeatSegment[] = [];
  let lastEnd = 0;

  for (const seg of cleaned) {
    if (seg.fromSeat <= lastEnd) {
      const from = lastEnd + 1;
      if (from <= seg.toSeat) {
        result.push({ ...seg, fromSeat: from });
        lastEnd = seg.toSeat;
      } else {
        result.push({ ...seg, fromSeat: from, toSeat: from });
        lastEnd = from;
      }
    } else {
      result.push(seg);
      lastEnd = seg.toSeat;
    }
  }

  return result;
}

export function SegmentedRowPreview({ blockName, row }: { blockName?: string; row: BlockRow }) {
  const seats: { num: number; category?: string }[] = [];
  for (let i = 1; i <= row.totalSeats; i++) {
    seats.push({ num: i });
  }
  row.segments.forEach((seg) => {
    for (let n = seg.fromSeat; n <= seg.toSeat && n <= row.totalSeats; n++) {
      seats[n - 1].category = seg.category;
    }
  });

  const label = blockName ? `${blockName} – Sıra ${row.rowNumber}` : `Sıra ${row.rowNumber}`;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-slate-500">Önizleme – {label}</span>
      <div className="flex flex-row items-center gap-2">
        <span className="w-8 text-right text-[10px] text-slate-500 font-medium">
          S{row.rowNumber}
        </span>
        <div
          className="flex flex-row items-center gap-0.5 flex-wrap"
          style={{ maxWidth: row.totalSeats * (SEAT_SIZE + SEAT_GAP) }}
        >
          {seats.map((s, idx) => {
            const color = s.category ? getCategoryColor(s.category) : "bg-slate-300";
            const isBoundary =
              idx > 0 &&
              row.segments.some(
                (seg) => seg.toSeat === seats[idx - 1].num || seg.fromSeat === s.num
              );

            return (
              <React.Fragment key={s.num}>
                {isBoundary && <div style={{ width: SEAT_SIZE, height: SEAT_SIZE }} />}
                <div
                  className={`rounded-full flex items-center justify-center text-[10px] text-white font-medium ${color} border border-white/50`}
                  style={{ width: SEAT_SIZE, height: SEAT_SIZE }}
                  title={`${label} · Koltuk ${s.num} ${s.category ? `· ${s.category}` : ""}`}
                >
                  {s.num}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <span className="w-8 text-[10px] text-slate-500 font-medium">
          S{row.rowNumber}
        </span>
      </div>
    </div>
  );
}
