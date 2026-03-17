"use client";

import { useState, useCallback } from "react";
import { musensaal } from "@/lib/seating-plans/musensaal";
import type { LinearRow, BlockRow, EmporeHintenRow } from "@/lib/seating-plans/musensaal";

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function createSeat(
  id: string,
  selected: boolean,
  onToggle: (id: string) => void,
  isBlock = false
) {
  return (
    <button
      key={id}
      type="button"
      className={`w-[14px] h-[14px] rounded-full border-0 p-0 cursor-pointer flex-shrink-0 ${
        selected ? "bg-green-500" : isBlock ? "bg-blue-300 hover:bg-blue-400" : "bg-slate-300 hover:bg-slate-400"
      }`}
      data-seat-id={id}
      onClick={() => onToggle(id)}
      title={id}
      aria-pressed={selected}
    />
  );
}

function Corridor({ wide }: { wide?: boolean }) {
  return <div className={`flex-shrink-0 bg-slate-100 rounded-sm ${wide ? "w-6 md:w-10 min-w-[24px]" : "w-3"}`} aria-hidden />;
}

// Tek bloklu (sadece seats sayısı olan) bölümler. rowLabelRight=true ise sıra no sağda (Parkett gibi). Parkett tek sıra = tek satır (29 sıra).
function LinearSection({
  rows,
  prefix,
  selectedIds,
  onToggle,
  rowLabelRight = false,
  aisleAfterRows,
  singleLinePerRow = false,
}: {
  rows: LinearRow[];
  prefix: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  rowLabelRight?: boolean;
  aisleAfterRows?: number[];
  singleLinePerRow?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 items-center">
      {rows.map((r) => (
        <div key={`${prefix}-${r.row}`} className="flex flex-col items-center">
          <div className={`flex items-center gap-1 justify-center ${rowLabelRight ? "flex-row-reverse" : ""}`}>
            <div className="w-10 text-right text-xs text-slate-500 flex-shrink-0">{r.row}</div>
            <div className={`flex gap-0.5 justify-center ${singleLinePerRow ? "flex-nowrap overflow-x-auto max-w-full" : "flex-wrap"}`}>
              {Array.from({ length: r.seats }, (_, i) => {
                const id = `${prefix}-${pad(r.row)}-${pad(i + 1)}`;
                return createSeat(id, selectedIds.has(id), onToggle);
              })}
            </div>
          </div>
          {aisleAfterRows?.includes(r.row) && <div className="h-2 w-full flex-shrink-0" aria-hidden />}
        </div>
      ))}
    </div>
  );
}

// Seitensempore: satır satır — 1. sıra 11+boşluk+11+boşluk+11+boşluk+11 (44), 2. sıra 4×10 (40), 3. sıra 4×9 (36). 9 sıra = 3 tier × 3 sıra. mirror=sağ taraf ayna.
function BlockSection({
  rows,
  prefix,
  selectedIds,
  onToggle,
  mirror = false,
  wideGaps = false,
}: {
  rows: BlockRow[];
  prefix: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  mirror?: boolean;
  wideGaps?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 items-center">
      {rows.map((r) => {
        const blocks = mirror ? [...r.blocks].reverse() : r.blocks;
        return (
          <div key={`${prefix}-${r.row}`} className="flex items-center gap-1 justify-center">
            <div className="w-10 text-right text-xs text-slate-500 flex-shrink-0">{r.row}</div>
            <div className="flex gap-0.5 flex-wrap items-center justify-center">
              {blocks.map((count, reversedIndex) => {
                const blockIndex = mirror ? r.blocks.length - 1 - reversedIndex : reversedIndex;
                return (
                  <span key={blockIndex} className="flex gap-0.5 items-center">
                    {Array.from({ length: count }, (_, i) => {
                      const id = `${prefix}-R${pad(r.row)}-B${blockIndex + 1}-S${pad(i + 1)}`;
                      return createSeat(id, selectedIds.has(id), onToggle, true);
                    })}
                    {reversedIndex < blocks.length - 1 && <Corridor wide={wideGaps} />}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Empore Hinten: left / middle / right — koltuklar ortada
function EmporeHintenSection({
  rows,
  prefix,
  selectedIds,
  onToggle,
}: {
  rows: EmporeHintenRow[];
  prefix: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 items-center">
      {rows.map((r) => (
        <div key={`${prefix}-${r.row}`} className="flex items-center gap-1 justify-center">
          <div className="w-10 text-right text-xs text-slate-500">{r.row}</div>
          <div className="flex gap-0.5 flex-wrap items-center justify-center">
            {Array.from({ length: r.left }, (_, i) => {
              const id = `${prefix}-R${pad(r.row)}-L${pad(i + 1)}`;
              return createSeat(id, selectedIds.has(id), onToggle, true);
            })}
            <Corridor />
            {Array.from({ length: r.middle }, (_, i) => {
              const id = `${prefix}-R${pad(r.row)}-M${pad(i + 1)}`;
              return createSeat(id, selectedIds.has(id), onToggle, true);
            })}
            <Corridor />
            {Array.from({ length: r.right }, (_, i) => {
              const id = `${prefix}-R${pad(r.row)}-Rt${pad(i + 1)}`;
              return createSeat(id, selectedIds.has(id), onToggle, true);
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MusensaalPlanViewer() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const onToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="text-slate-800 flex flex-col items-center w-full">
      {/* Sayfa 3 bölüm: Sol = Seitensempore Links | Orta = Sahne + Parkett | Sağ = Seitensempore Rechts */}
      <div className="grid grid-cols-1 md:grid-cols-3 w-full max-w-6xl gap-6 md:gap-8 mb-8 items-start">
        {/* Sol: Seitensempore Links — U'dan 2 kat daha uzak */}
        <div className="flex flex-col items-center min-w-0 md:mr-24">
          <div className="w-0 h-32 md:h-40 mb-1 flex-shrink-0" aria-hidden />
          <div className="mb-0.5 text-sm font-bold text-slate-700 text-center leading-tight">
            Seitens<br />empore<br />Links
          </div>
          <div className="flex flex-col gap-3 items-center">
            {[0, 1, 2, 3].map((section) => (
              <div key={section} className="flex gap-1 items-start justify-center">
                {[9, 10, 11].map((count, colIndex) => {
                  const rowNum = colIndex === 0 ? 3 : colIndex === 1 ? 2 : 1;
                  const start = rowNum === 1 ? section * 11 : rowNum === 2 ? section * 10 : section * 9;
                  return (
                    <div key={colIndex} className="flex flex-col gap-0.5 items-center">
                      {Array.from({ length: count }, (_, i) => {
                        const seatNum = start + i + 1;
                        const id = `SEL-${pad(rowNum)}-${pad(seatNum)}`;
                        return createSeat(id, selectedIds.has(id), onToggle, true);
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Orta — BÜHNE + U; U Seitensempore'dan 2 kat daha uzak */}
        <div className="flex flex-col items-center md:px-8">
          <div className="mb-6 w-48 h-24 md:w-56 md:h-28 rounded border-2 border-slate-400 bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-base md:text-lg">
            BÜHNE
          </div>
          <div className="rounded-t-xl border-l-2 border-r-2 border-b-2 border-slate-400 px-4 pt-3 pb-2">
            <div className="mb-2 text-sm font-bold text-slate-700 text-center">Parkett</div>
            <div className="flex flex-col gap-1 items-center">
              {musensaal.parkett.rows.map((r) => (
                <div key={`P-${r.row}`} className="flex flex-col items-center">
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-14 flex-shrink-0 text-[10px] text-slate-500 text-left">
                      {r.row === 4 && "Eingang A"}
                      {r.row === 11 && "Eingang B"}
                      {r.row === 18 && "Eingang C"}
                    </div>
                    <div className="flex flex-row-reverse items-center gap-1 justify-center flex-1 min-w-0">
                      <div className="w-10 text-right text-xs text-slate-500 flex-shrink-0">{r.row}</div>
                      <div className="flex gap-0.5 justify-center flex-nowrap overflow-x-auto max-w-full">
                        {Array.from({ length: r.seats }, (_, i) => {
                          const id = `P-${pad(r.row)}-${pad(i + 1)}`;
                          return createSeat(id, selectedIds.has(id), onToggle);
                        })}
                      </div>
                    </div>
                    <div className="w-14 flex-shrink-0 text-[10px] text-slate-500 text-right">
                      {r.row === 4 && "Eingang A"}
                      {r.row === 10 && "Eingang B"}
                      {r.row === 17 && "Eingang C"}
                      {r.row === 24 && "Eingang D"}
                    </div>
                  </div>
                  {[3, 7, 13, 20].includes(r.row) && <div className="h-2 w-full flex-shrink-0" aria-hidden />}
                </div>
              ))}
            </div>
            {/* U alttan: Fuaye; kapılar fuayede, sol 4 / sağ 4, dikeyde dağıtılmış (Eingang hizası) */}
            <div className="mt-4 pt-4 border-t border-slate-200 min-h-[200px] flex flex-col items-stretch -mx-4 px-4">
              <div className="flex-1 flex items-center justify-center py-4">
                <span className="text-lg font-bold text-slate-600">Fuaye</span>
              </div>
              {/* Kapı bandı: yükseklik sabit, sol/sağda 4'er kapı eşit aralıkla */}
              <div className="flex w-full justify-between items-stretch gap-4 h-28 flex-shrink-0">
                <div className="flex flex-col justify-between items-start pl-2 flex-shrink-0 text-[10px] text-slate-500 py-1">
                  {["A", "B", "C", "D"].map((label, i) => (
                    <span key={label} className="flex flex-col items-start gap-0.5" title={`Eingang ${label} karşısı`}>
                      <span className="w-10 h-2 bg-slate-300 rounded-sm" aria-hidden />
                    </span>
                  ))}
                </div>
                <div className="flex justify-center items-center gap-0.5 flex-shrink-0" title="Çıkış (çift kanatlı)">
                  <span className="w-6 h-3 bg-slate-300 rounded-sm" aria-hidden />
                  <span className="w-6 h-3 bg-slate-300 rounded-sm" aria-hidden />
                </div>
                <div className="flex flex-col justify-between items-end pr-2 flex-shrink-0 text-[10px] text-slate-500 py-1 text-right">
                  {["A", "B", "C", "D"].map((label) => (
                    <span key={label} className="flex flex-col items-end gap-0.5" title={`Eingang ${label} karşısı`}>
                      <span className="w-10 h-2 bg-slate-300 rounded-sm ml-auto" aria-hidden />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sağ: Seitensempore Rechts — U'dan 2 kat daha uzak */}
        <div className="flex flex-col items-center min-w-0 md:ml-24">
          <div className="w-0 h-32 md:h-40 mb-1 flex-shrink-0" aria-hidden />
          <div className="mb-0.5 text-sm font-bold text-slate-700 text-center leading-tight">
            Seitens<br />empore<br />Rechts
          </div>
          <div className="flex flex-col gap-3 items-center">
            {[0, 1, 2, 3].map((section) => (
              <div key={section} className="flex gap-1 items-start justify-center">
                {[11, 10, 9].map((count, colIndex) => {
                  const rowNum = colIndex + 1;
                  const start = rowNum === 1 ? section * 11 : rowNum === 2 ? section * 10 : section * 9;
                  return (
                    <div key={colIndex} className="flex flex-col gap-0.5 items-center">
                      {Array.from({ length: count }, (_, i) => {
                        const seatNum = start + i + 1;
                        const id = `SER-${pad(rowNum)}-${pad(seatNum)}`;
                        return createSeat(id, selectedIds.has(id), onToggle, true);
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Parkett'in arkası: Empore Mitte Sol | Empore Mitte Sağ */}
      <div className="flex flex-wrap justify-center items-start gap-8 md:gap-16 mb-8">
        <div className="flex flex-col items-center">
          <div className="mb-2 text-sm font-bold text-slate-700">Empore Mitte Sol</div>
          <LinearSection
            rows={musensaal.emporeMitte.left.rows}
            prefix="EML"
            selectedIds={selectedIds}
            onToggle={onToggle}
          />
        </div>
        <div className="flex flex-col items-center">
          <div className="mb-2 text-sm font-bold text-slate-700">Empore Mitte Sağ</div>
          <LinearSection
            rows={musensaal.emporeMitte.right.rows}
            prefix="EMR"
            selectedIds={selectedIds}
            onToggle={onToggle}
          />
        </div>
      </div>

      {/* En arka: Empore Hinten */}
      <div className="flex flex-col items-center">
        <div className="mb-2 text-sm font-bold text-slate-700">Empore Hinten</div>
        <EmporeHintenSection
          rows={musensaal.emporeHinten.rows}
          prefix="EH"
          selectedIds={selectedIds}
          onToggle={onToggle}
        />
      </div>
    </div>
  );
}
