"use client";

import React, { useState, type Dispatch, type SetStateAction } from "react";
import { Plan2Layout } from "./Plan2BlockDesignerLayout";
import type { Block, BlockRow, SeatSegment, BlockType, BlockOrientation } from "./Plan2BlockDesignerShared";
import { normalizeSegments } from "./Plan2BlockDesignerShared";

export type { Block, BlockRow, SeatSegment, BlockType, BlockOrientation } from "./Plan2BlockDesignerShared";

function getDefaultNameForBlockType(blockType: BlockType, existingCount: number): string {
  const names: Record<BlockType, string> = {
    centerFront: "Orta blok (sahne önü)",
    centerBack: "Orta blok (sahne arkası)",
    rightHorizontal: "Sağ blok (yatay)",
    rightVertical: "Sağ blok (dikey)",
    leftHorizontal: "Sol blok (yatay)",
    leftVertical: "Sol blok (dikey)",
    corridor: existingCount > 0 ? `Koridor ${existingCount + 1}` : "Koridor",
  };
  return names[blockType];
}

function createBlockId() {
  return crypto.randomUUID();
}

function createSegmentId() {
  return crypto.randomUUID();
}

const DEFAULT_BLOCKS: Block[] = [
  {
    id: createBlockId(),
    name: "Orta salon",
    blockType: "centerFront",
    rows: [
      {
        id: crypto.randomUUID(),
        rowNumber: 1,
        totalSeats: 42,
        segments: [
          { id: createSegmentId(), fromSeat: 1, toSeat: 11, category: "VIP" },
          { id: createSegmentId(), fromSeat: 12, toSeat: 22, category: "Kategori 2" },
          { id: createSegmentId(), fromSeat: 23, toSeat: 31, category: "Kategori 3" },
          { id: createSegmentId(), fromSeat: 32, toSeat: 42, category: "Kategori 4" },
        ],
      },
    ],
  },
];

type Plan2BlockDesignerProps = {
  /** Controlled: planı kaydeden üst bileşen state'i yönetir */
  blocks?: Block[];
  onBlocksChange?: Dispatch<SetStateAction<Block[]>>;
};

export default function Plan2BlockDesigner({ blocks: controlledBlocks, onBlocksChange }: Plan2BlockDesignerProps) {
  const [internalBlocks, setInternalBlocks] = useState<Block[]>(DEFAULT_BLOCKS);
  const isControlled = controlledBlocks != null && onBlocksChange != null;
  const blocks = isControlled ? controlledBlocks : internalBlocks;
  /** React setState ile uyumlu: fonksiyonel guncellemeyi parent'a oldugu gibi iletir (closure'daki blocks kullanilmaz). */
  const setBlocks = (action: SetStateAction<Block[]>) => {
    if (isControlled) onBlocksChange!(action);
    else setInternalBlocks(action);
  };

  const [orientation, setOrientation] = useState<BlockOrientation>("horizontal");

  const addBlock = (blockType: BlockType) => {
    if (blockType === "corridor") return; // Koridor artık sadece "blokun arkasına" ile eklenir
    const name = getDefaultNameForBlockType(blockType, 0);
    setBlocks((prev) => [
      ...prev,
      {
        id: createBlockId(),
        name,
        blockType,
        rows: [
          {
            id: crypto.randomUUID(),
            rowNumber: 1,
            totalSeats: 20,
            segments: [],
          },
        ],
      },
    ]);
  };

  /** Seçilen blokun hemen arkasına (sonrasına) boydan boya koridor ekler. */
  const addCorridorAfterBlock = (blockId: string) => {
    const corridorCount = blocks.filter((b) => b.blockType === "corridor").length;
    const name = corridorCount > 0 ? `Koridor ${corridorCount + 1}` : "Koridor";
    const newCorridor: Block = {
      id: createBlockId(),
      name,
      blockType: "corridor",
      rows: [],
    };
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) {
      setBlocks((prev) => [...prev, newCorridor]);
      return;
    }
    setBlocks((prev) => [
      ...prev.slice(0, idx + 1),
      newCorridor,
      ...prev.slice(idx + 1),
    ]);
  };

  const updateBlock = (blockId: string, partial: Partial<Pick<Block, "name" | "blockType">>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, ...partial } : b))
    );
  };

  const addRow = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const nextNum = b.rows.length + 1;
        const lastSeats = b.rows[b.rows.length - 1]?.totalSeats ?? 20;
        return {
          ...b,
          rows: [
            ...b.rows,
            {
              id: crypto.randomUUID(),
              rowNumber: nextNum,
              totalSeats: lastSeats,
              segments: [],
            },
          ],
        };
      })
    );
  };

  const updateRow = (blockId: string, rowId: string, partial: Partial<BlockRow>) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id !== blockId
          ? b
          : {
              ...b,
              rows: b.rows.map((r) => (r.id === rowId ? { ...r, ...partial } : r)),
            }
      )
    );
  };

  const removeRow = (blockId: string, rowId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        if (b.rows.length <= 1) return b;
        return {
          ...b,
          rows: b.rows.filter((r) => r.id !== rowId),
        };
      })
    );
  };

  const applyRowsPreset = (blockId: string, rowCount: number, seatsPerRow: number) => {
    const rc = Number(rowCount);
    const sp = Number(seatsPerRow);
    const safeRowCount = Number.isFinite(rc) && rc > 0 ? Math.max(1, Math.min(300, Math.floor(rc))) : 1;
    const safeSeatsPerRow = Number.isFinite(sp) && sp > 0 ? Math.max(1, Math.min(500, Math.floor(sp))) : 1;
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || b.blockType === "corridor") return b;
        const nextRows: BlockRow[] = Array.from({ length: safeRowCount }, (_, i) => ({
          id: crypto.randomUUID(),
          rowNumber: i + 1,
          totalSeats: safeSeatsPerRow,
          segments: [],
        }));
        return { ...b, rows: nextRows };
      })
    );
  };

  const applyCategoryToRowRange = (blockId: string, fromRowNumber: number, toRowNumber: number, category: string) => {
    const lo = Math.max(1, Math.floor(Math.min(fromRowNumber, toRowNumber)));
    const hi = Math.max(1, Math.floor(Math.max(fromRowNumber, toRowNumber)));
    const safeCategory = (category || "VIP").trim() || "VIP";
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId || b.blockType === "corridor") return b;
        return {
          ...b,
          rows: b.rows.map((r) =>
            r.rowNumber >= lo && r.rowNumber <= hi
              ? {
                  ...r,
                  segments: [
                    {
                      id: createSegmentId(),
                      fromSeat: 1,
                      toSeat: r.totalSeats,
                      category: safeCategory,
                    },
                  ],
                }
              : r
          ),
        };
      })
    );
  };

  const addSegment = (blockId: string, rowId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          rows: b.rows.map((r) =>
            r.id !== rowId
              ? r
              : {
                  ...r,
                  segments: [
                    ...r.segments,
                    {
                      id: createSegmentId(),
                      fromSeat: 1,
                      toSeat: Math.min(r.totalSeats, 5),
                      category: "VIP",
                    },
                  ],
                }
          ),
        };
      })
    );
  };

  const updateSegment = (
    blockId: string,
    rowId: string,
    segId: string,
    partial: Partial<SeatSegment>
  ) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const nextRows = b.rows.map((r) => {
          if (r.id !== rowId) return r;
          return {
            ...r,
            segments: normalizeSegments(
              r.totalSeats,
              r.segments.map((s) => (s.id === segId ? { ...s, ...partial } : s))
            ),
          };
        });
        return { ...b, rows: nextRows };
      })
    );
  };

  const removeSegment = (blockId: string, rowId: string, segId: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id !== blockId ? b : {
          ...b,
          rows: b.rows.map((r) =>
            r.id === rowId ? { ...r, segments: r.segments.filter((s) => s.id !== segId) } : r
          ),
        }
      )
    );
  };

  const removeBlock = (blockId: string) => {
    if (typeof window !== "undefined" && !window.confirm("Bu blok kaldırılsın mı? Bu işlem geri alınamaz.")) return;
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  };

  return React.createElement(Plan2Layout, {
    blocks,
    orientation,
    setOrientation,
    updateBlock,
    addCorridorAfterBlock,
    addRow,
    removeRow,
    applyRowsPreset,
    applyCategoryToRowRange,
    updateRow,
    addSegment,
    updateSegment,
    removeSegment,
    removeBlock,
    addBlock,
  });
}
