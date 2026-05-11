"use client";

import React, { useState } from "react";
import {
  type Block,
  type BlockRow,
  type SeatSegment,
  type BlockType,
  type BlockOrientation,
  BLOCK_TYPE_OPTIONS,
  CATEGORY_OPTIONS,
  normalizeSegments,
  SegmentedRowPreview,
} from "./Plan2BlockDesignerShared";

function safePositiveInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw.replace(/\s/g, ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

export type Plan2LayoutProps = {
  blocks: Block[];
  orientation: BlockOrientation;
  setOrientation: (o: BlockOrientation) => void;
  updateBlock: (id: string, p: Partial<Pick<Block, "name" | "blockType">>) => void;
  addCorridorAfterBlock: (id: string) => void;
  addRow: (id: string) => void;
  removeRow: (id: string, rowId: string) => void;
  applyRowsPreset: (id: string, rowCount: number, seatsPerRow: number) => void;
  applyCategoryToRowRange: (id: string, fromRowNumber: number, toRowNumber: number, category: string) => void;
  updateRow: (id: string, rowId: string, p: Partial<BlockRow>) => void;
  addSegment: (blockId: string, rowId: string) => void;
  updateSegment: (blockId: string, rowId: string, segId: string, p: Partial<SeatSegment>) => void;
  removeSegment: (blockId: string, rowId: string, segId: string) => void;
  removeBlock: (blockId: string) => void;
  addBlock: (t: BlockType) => void;
};

export function Plan2Layout(props: Plan2LayoutProps) {
  const {
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
  } = props;
  const [presetByBlockId, setPresetByBlockId] = useState<Record<string, { rowCount: number; seatsPerRow: number }>>({});
  const [rowCategoryByBlockId, setRowCategoryByBlockId] = useState<Record<string, { fromRow: number; toRow: number; category: string }>>({});

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 mt-8 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Plan 2 – Blok Tasarımcısı</h2>
          <p className="text-xs text-slate-500 max-w-xl">
            Burada tek bir blok için satır/sütun içinde istediğin kadar koridor (segment) tanımlayabilir,
            her segmente kategori verebilir ve sonucu önizlemede görebilirsin. Aynı mantığı Parkett, sol, sağ ve
            sahne arkası bloklarında kullanarak her türlü salonu kurabilirsin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Yön:</span>
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as BlockOrientation)}
            className="text-sm rounded border border-slate-300 px-2 py-1"
          >
            <option value="horizontal">Yatay (Parkett gibi)</option>
            <option value="vertical">Dikey (yan blok gibi)</option>
          </select>
        </div>
      </div>

      <div className="space-y-6">
        {blocks.map((block) => {
          const isCorridor = block.blockType === "corridor";
          const typeLabel = BLOCK_TYPE_OPTIONS.find((o) => o.value === block.blockType)?.label || block.blockType || "Blok";
          return (
            <div
              key={block.id}
              className={`rounded-lg border p-4 space-y-4 ${isCorridor ? "border-slate-400 bg-slate-100/80" : "border-slate-300 bg-white"}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-500 px-2 py-0.5 rounded bg-slate-200">
                  {typeLabel}
                </span>
                <label className="text-sm font-medium text-slate-700">
                  Blok adı
                  <input
                    type="text"
                    value={block.name}
                    onChange={(e) => updateBlock(block.id, { name: e.target.value })}
                    placeholder="Örn: Orta salon, Sol blok"
                    className="ml-2 min-w-[180px] rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
                {!isCorridor && (
                  <button
                    type="button"
                    onClick={() => addCorridorAfterBlock(block.id)}
                    className="px-2 py-1 text-xs rounded border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200"
                  >
                    + Koridor ekle (bu blokun arkasına)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className="ml-auto px-2 py-1 text-xs rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                  title="Bu bloku listeden kaldır"
                >
                  Blok kaldır
                </button>
              </div>

              {isCorridor ? (
                <p className="text-sm text-slate-600 italic pl-2 border-l-2 border-slate-400">
                  Yürüme koridoru – koltuk yok. Önizlemede boş alan olarak gösterilir.
                </p>
              ) : (
                <div>
                  <div className="mb-3 rounded-md border border-indigo-200 bg-indigo-50 p-2">
                    <p className="mb-2 text-xs font-medium text-indigo-900">Hızlı sıra oluştur</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-xs text-slate-700">
                        Sıra sayısı
                        <input
                          type="number"
                          min={1}
                          value={
                            Number.isFinite(presetByBlockId[block.id]?.rowCount)
                              ? presetByBlockId[block.id]!.rowCount
                              : block.rows.length
                          }
                          onChange={(e) => {
                            const rowCount = safePositiveInt(e.target.value, block.rows.length || 1);
                            setPresetByBlockId((prev) => ({
                              ...prev,
                              [block.id]: {
                                rowCount,
                                seatsPerRow: prev[block.id]?.seatsPerRow ?? block.rows[0]?.totalSeats ?? 20,
                              },
                            }));
                          }}
                          className="ml-2 w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-xs text-slate-700">
                        Her sırada koltuk
                        <input
                          type="number"
                          min={1}
                          value={
                            Number.isFinite(presetByBlockId[block.id]?.seatsPerRow)
                              ? presetByBlockId[block.id]!.seatsPerRow
                              : block.rows[0]?.totalSeats ?? 20
                          }
                          onChange={(e) => {
                            const seatsPerRow = safePositiveInt(e.target.value, block.rows[0]?.totalSeats ?? 20);
                            setPresetByBlockId((prev) => ({
                              ...prev,
                              [block.id]: {
                                rowCount: prev[block.id]?.rowCount ?? block.rows.length,
                                seatsPerRow,
                              },
                            }));
                          }}
                          className="ml-2 w-24 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const rowFallback = Math.max(1, block.rows.length || 1);
                          const seatFallback = Math.max(1, block.rows[0]?.totalSeats ?? 20);
                          const rawRows = presetByBlockId[block.id]?.rowCount ?? rowFallback;
                          const rawSeats = presetByBlockId[block.id]?.seatsPerRow ?? seatFallback;
                          applyRowsPreset(
                            block.id,
                            Number.isFinite(rawRows) && rawRows >= 1 ? rawRows : rowFallback,
                            Number.isFinite(rawSeats) && rawSeats >= 1 ? rawSeats : seatFallback
                          );
                        }}
                        className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        Uygula (mevcut sıraları yeniler)
                      </button>
                    </div>
                  </div>
                  <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2">
                    <p className="mb-2 text-xs font-medium text-amber-900">Sıra aralığına kategori ata</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-xs text-slate-700">
                        Başlangıç sıra
                        <input
                          type="number"
                          min={1}
                          value={rowCategoryByBlockId[block.id]?.fromRow ?? 1}
                          onChange={(e) => {
                            const fromRow = Math.max(1, parseInt(e.target.value || "1", 10));
                            setRowCategoryByBlockId((prev) => ({
                              ...prev,
                              [block.id]: {
                                fromRow,
                                toRow: prev[block.id]?.toRow ?? Math.max(1, block.rows.length),
                                category: prev[block.id]?.category ?? "VIP",
                              },
                            }));
                          }}
                          className="ml-2 w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-xs text-slate-700">
                        Bitiş sıra
                        <input
                          type="number"
                          min={1}
                          value={rowCategoryByBlockId[block.id]?.toRow ?? Math.max(1, block.rows.length)}
                          onChange={(e) => {
                            const toRow = Math.max(1, parseInt(e.target.value || "1", 10));
                            setRowCategoryByBlockId((prev) => ({
                              ...prev,
                              [block.id]: {
                                fromRow: prev[block.id]?.fromRow ?? 1,
                                toRow,
                                category: prev[block.id]?.category ?? "VIP",
                              },
                            }));
                          }}
                          className="ml-2 w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-xs text-slate-700">
                        Kategori
                        <select
                          value={rowCategoryByBlockId[block.id]?.category ?? "VIP"}
                          onChange={(e) => {
                            const category = e.target.value;
                            setRowCategoryByBlockId((prev) => ({
                              ...prev,
                              [block.id]: {
                                fromRow: prev[block.id]?.fromRow ?? 1,
                                toRow: prev[block.id]?.toRow ?? Math.max(1, block.rows.length),
                                category,
                              },
                            }));
                          }}
                          className="ml-2 rounded border border-slate-300 px-2 py-1 text-xs"
                        >
                          {CATEGORY_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          applyCategoryToRowRange(
                            block.id,
                            rowCategoryByBlockId[block.id]?.fromRow ?? 1,
                            rowCategoryByBlockId[block.id]?.toRow ?? Math.max(1, block.rows.length),
                            rowCategoryByBlockId[block.id]?.category ?? "VIP"
                          )
                        }
                        className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
                      >
                        Uygula (seçilen sıralara)
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3 pl-2 border-l-2 border-slate-200">
                    {block.rows.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-lg border border-slate-200 p-3 bg-slate-50/80 space-y-2"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <label className="text-xs font-medium text-slate-600">
                            Sıra (blok içinde)
                            <input
                              type="number"
                              min={1}
                              value={row.rowNumber}
                              onChange={(e) =>
                                updateRow(block.id, row.id, {
                                  rowNumber: Math.max(1, parseInt(e.target.value || "1", 10)),
                                })
                              }
                              className="ml-2 w-14 rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                          </label>
                          <label className="text-xs font-medium text-slate-600">
                            Toplam koltuk
                            <input
                              type="number"
                              min={1}
                              value={row.totalSeats}
                              onChange={(e) => {
                                const total = Math.max(1, parseInt(e.target.value || "1", 10));
                                updateRow(block.id, row.id, {
                                  totalSeats: total,
                                  segments: normalizeSegments(total, row.segments),
                                });
                              }}
                              className="ml-2 w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => addSegment(block.id, row.id)}
                            className="ml-auto px-2 py-1 text-xs rounded bg-primary-600 text-white hover:bg-primary-700"
                          >
                            + Segment ekle (koridor)
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(block.id, row.id)}
                            disabled={block.rows.length <= 1}
                            className="px-2 py-1 text-xs rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            title={block.rows.length <= 1 ? "Blokta en az 1 sıra kalmalı" : "Bu sırayı sil"}
                          >
                            Sırayı sil
                          </button>
                        </div>

                        {row.segments.length === 0 ? (
                          <p className="text-xs text-slate-500">
                            Henüz segment yok. Örn: 1–11, 12–22, 23–31, 32–42 gibi aralıklar ekleyip her birine kategori ver.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs text-slate-700 border border-slate-200 rounded">
                              <thead className="bg-slate-100">
                                <tr>
                                  <th className="px-2 py-1 text-left">#</th>
                                  <th className="px-2 py-1 text-left">Başlangıç</th>
                                  <th className="px-2 py-1 text-left">Bitiş</th>
                                  <th className="px-2 py-1 text-left">Kategori</th>
                                  <th className="px-2 py-1"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.segments.map((seg, idx) => (
                                  <tr key={seg.id} className="border-t border-slate-200">
                                    <td className="px-2 py-1">{idx + 1}</td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="number"
                                        min={1}
                                        max={row.totalSeats}
                                        value={seg.fromSeat}
                                        onChange={(e) =>
                                          updateSegment(block.id, row.id, seg.id, {
                                            fromSeat: parseInt(e.target.value || "1", 10),
                                          })
                                        }
                                        className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <input
                                        type="number"
                                        min={1}
                                        max={row.totalSeats}
                                        value={seg.toSeat}
                                        onChange={(e) =>
                                          updateSegment(block.id, row.id, seg.id, {
                                            toSeat: parseInt(e.target.value || "1", 10),
                                          })
                                        }
                                        className="w-16 rounded border border-slate-300 px-1 py-0.5 text-xs"
                                      />
                                    </td>
                                    <td className="px-2 py-1">
                                      <select
                                        value={seg.category}
                                        onChange={(e) =>
                                          updateSegment(block.id, row.id, seg.id, { category: e.target.value })
                                        }
                                        className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                                      >
                                        {CATEGORY_OPTIONS.map((c) => (
                                          <option key={c} value={c}>
                                            {c}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="px-2 py-1 text-right">
                                      <button
                                        type="button"
                                        onClick={() => removeSegment(block.id, row.id, seg.id)}
                                        className="text-xs text-red-600 hover:underline"
                                      >
                                        Sil
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        <SegmentedRowPreview blockName={block.name || undefined} row={row} />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => addRow(block.id)}
                    className="px-3 py-1.5 text-xs rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    + Bu bloka yeni sıra ekle
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">Blok ekle:</span>
        <select
          value=""
          onChange={(e) => {
            const v = e.target.value as BlockType | "";
            if (v) {
              addBlock(v);
              e.target.value = "";
            }
          }}
          className="text-sm rounded border border-primary-500 bg-primary-50 text-primary-800 px-3 py-1.5 min-w-[200px]"
          aria-label="Eklenecek blok türünü seçin"
        >
          <option value="">— Tür seçin —</option>
          {["Orta blok", "Sol blok", "Sağ blok"].map((group) => (
            <optgroup key={group} label={group}>
              {BLOCK_TYPE_OPTIONS.filter((o) => o.group === group).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}
