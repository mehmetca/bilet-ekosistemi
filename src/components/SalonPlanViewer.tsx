"use client";

import { useState, useCallback } from "react";
import type { SalonPlanConfig } from "@/lib/seating-plans/types";
import type { LinearRow, BlockRow, EmporeHintenRow } from "@/lib/seating-plans/types";

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function createSeat(
  id: string,
  selected: boolean,
  onToggle: (id: string) => void,
  isBlock = false,
  sold = false,
  unavailable = false
) {
  const disabled = sold || unavailable;
  return (
    <button
      key={id}
      type="button"
      disabled={disabled}
      className={`w-[14px] h-[14px] rounded-full border-0 p-0 flex-shrink-0 ${
        sold
          ? "bg-slate-300 cursor-not-allowed ring-0"
          : unavailable
            ? "bg-slate-400 cursor-not-allowed opacity-75 ring-0"
            : selected
              ? "bg-[#39ff14] cursor-pointer ring-0"
              : isBlock
                ? "bg-blue-300 hover:bg-blue-400 cursor-pointer ring-0"
                : "bg-slate-300 hover:bg-slate-400 cursor-pointer ring-0"
      }`}
      data-seat-id={id}
      onClick={() => !disabled && onToggle(id)}
      title={sold ? `${id} (satıldı)` : unavailable ? `${id} (seçilemez)` : id}
      aria-pressed={selected}
      aria-disabled={disabled}
    />
  );
}

function Corridor({ wide }: { wide?: boolean }) {
  return <div className={`flex-shrink-0 bg-slate-100 rounded-sm ${wide ? "w-6 md:w-10 min-w-[24px]" : "w-3"}`} aria-hidden />;
}

function LinearSection({
  rows,
  prefix,
  selectedIds,
  soldIds,
  selectableIds,
  onToggle,
  rowLabelRight = false,
  aisleAfterRows,
  singleLinePerRow = false,
}: {
  rows: LinearRow[];
  prefix: string;
  selectedIds: Set<string>;
  soldIds?: Set<string>;
  selectableIds?: Set<string>;
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
                return createSeat(id, selectedIds.has(id), onToggle, false, soldIds?.has(id), selectableIds ? !selectableIds.has(id) : false);
              })}
            </div>
          </div>
          {aisleAfterRows?.includes(r.row) && <div className="h-2 w-full flex-shrink-0" aria-hidden />}
        </div>
      ))}
    </div>
  );
}

function BlockSection({
  rows,
  prefix,
  selectedIds,
  soldIds,
  selectableIds,
  onToggle,
  mirror = false,
  wideGaps = false,
}: {
  rows: BlockRow[];
  prefix: string;
  selectedIds: Set<string>;
  soldIds?: Set<string>;
  selectableIds?: Set<string>;
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
                      return createSeat(id, selectedIds.has(id), onToggle, true, soldIds?.has(id), selectableIds ? !selectableIds.has(id) : false);
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

function EmporeHintenSection({
  rows,
  prefix,
  selectedIds,
  soldIds,
  selectableIds,
  onToggle,
}: {
  rows: EmporeHintenRow[];
  prefix: string;
  selectedIds: Set<string>;
  soldIds?: Set<string>;
  selectableIds?: Set<string>;
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
              return createSeat(id, selectedIds.has(id), onToggle, true, soldIds?.has(id), selectableIds ? !selectableIds.has(id) : false);
            })}
            <Corridor />
            {Array.from({ length: r.middle }, (_, i) => {
              const id = `${prefix}-R${pad(r.row)}-M${pad(i + 1)}`;
              return createSeat(id, selectedIds.has(id), onToggle, true, soldIds?.has(id), selectableIds ? !selectableIds.has(id) : false);
            })}
            <Corridor />
            {Array.from({ length: r.right }, (_, i) => {
              const id = `${prefix}-R${pad(r.row)}-Rt${pad(i + 1)}`;
              return createSeat(id, selectedIds.has(id), onToggle, true, soldIds?.has(id), selectableIds ? !selectableIds.has(id) : false);
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Fuaye alanı – genişletilmiş (kapı sembolleri yok) */
function FoyerBlock({ label }: { label: string }) {
  return (
    <div className="mt-4 pt-4 border-t border-slate-200 min-h-[200px] flex flex-col items-stretch -mx-8 px-8 py-8">
      <div className="flex flex-1 items-center justify-center">
        <span className="text-xl font-bold text-slate-600">{label}</span>
      </div>
    </div>
  );
}

function getEingangForRow(row: number, labels: { row: number; label: string }[]): string | null {
  const found = labels.find((e) => e.row === row);
  return found ? found.label : null;
}

interface SalonPlanViewerProps {
  plan: SalonPlanConfig;
  selectedIds?: Set<string>;
  soldIds?: Set<string>;
  /** DB'de karşılığı olan koltuklar (logical id). Verilmezse tümü seçilebilir. */
  selectableIds?: Set<string>;
  onToggle?: (id: string) => void;
}

export default function SalonPlanViewer({ plan, selectedIds: controlledIds, soldIds, selectableIds, onToggle: controlledOnToggle }: SalonPlanViewerProps) {
  const [internalIds, setInternalIds] = useState<Set<string>>(new Set());
  const selectedIds = controlledIds ?? internalIds;
  const onToggle = useCallback(
    (id: string) => {
      if (controlledOnToggle) {
        controlledOnToggle(id);
        return;
      }
      setInternalIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [controlledOnToggle]
  );

  if (plan.layout !== "musensaal") {
    return (
      <div className="text-slate-500 p-4">
        Bu plan tipi henüz desteklenmiyor: {plan.layout}
      </div>
    );
  }

  const L = plan.seitenEmporeLinks;
  const R = plan.seitenEmporeRechts;
  // Musensaal Seitensempore: 4 bölüm, 3 sıra; sol [9,10,11] (row 3,2,1), sağ [11,10,9] (row 1,2,3)
  const leftCounts = [9, 10, 11];
  const rightCounts = [11, 10, 9];

  return (
    <div className="text-slate-800 flex flex-col items-center w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 w-full max-w-6xl gap-6 md:gap-8 mb-8 items-start">
        {/* Sol: Seitensempore Links – ilk koltuk Parkett ilk koltuk hizasında */}
        <div className="flex flex-col items-center min-w-0 md:mr-24">
          <div className="w-0 h-[6.5rem] md:h-[7.5rem] mb-1 flex-shrink-0" aria-hidden />
          <div className="mb-0.5 text-sm font-bold text-slate-700 text-center leading-tight">
            {L.labelLines ? L.labelLines.map((line, i) => <span key={i}>{line}{i < L.labelLines!.length - 1 && <br />}</span>) : L.label}
          </div>
          <div className="flex flex-col gap-3 items-center">
            {[0, 1, 2, 3].map((section) => (
              <div key={section} className="flex gap-1 items-start justify-center">
                {leftCounts.map((count, colIndex) => {
                  const rowNum = colIndex === 0 ? 3 : colIndex === 1 ? 2 : 1;
                  const start = rowNum === 1 ? section * 11 : rowNum === 2 ? section * 10 : section * 9;
                  return (
                    <div key={colIndex} className="flex flex-col gap-0.5 items-center">
                      {Array.from({ length: count }, (_, i) => {
                        const seatNum = start + i + 1;
                        const id = `${L.prefix}-${pad(rowNum)}-${pad(seatNum)}`;
                        return createSeat(id, selectedIds.has(id), onToggle, true, soldIds?.has(id), selectableIds ? !selectableIds.has(id) : false);
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Orta: BÜHNE + Parkett + Fuaye */}
        <div className="flex flex-col items-center md:px-8">
          <div className="mb-6 w-48 h-24 md:w-56 md:h-28 rounded border-2 border-slate-400 bg-slate-200 flex items-center justify-center text-slate-600 font-semibold text-base md:text-lg">
            {plan.stageLabel ?? "BÜHNE"}
          </div>
          <div className="rounded-t-xl border-l-2 border-r-2 border-b-2 border-slate-400 px-4 pt-3 pb-2">
            <div className="mb-2 text-sm font-bold text-slate-700 text-center">Parkett</div>
            <div className="flex flex-col gap-1 items-center">
              {plan.parkett.rows.map((r) => {
                const leftEingang = getEingangForRow(r.row, plan.eingangLeft);
                const rightEingang = getEingangForRow(r.row, plan.eingangRight);
                return (
                  <div key={`P-${r.row}`} className="flex flex-col items-center">
                    <div className="flex items-center gap-2 w-full">
                      <div className="w-14 flex-shrink-0 text-[10px] text-slate-500 text-left">
                        {leftEingang ? `Eingang ${leftEingang}` : ""}
                      </div>
                      <div className="flex flex-row-reverse items-center gap-1 justify-center flex-1 min-w-0">
                        <div className="w-10 text-right text-xs text-slate-500 flex-shrink-0">{r.row}</div>
                        <div className="flex gap-0.5 justify-center flex-nowrap overflow-x-auto max-w-full">
                          {Array.from({ length: r.seats }, (_, i) => {
                            const id = `P-${pad(r.row)}-${pad(i + 1)}`;
                            return createSeat(id, selectedIds.has(id), onToggle, false, soldIds?.has(id), selectableIds ? !selectableIds.has(id) : false);
                          })}
                        </div>
                      </div>
                      <div className="w-14 flex-shrink-0 text-[10px] text-slate-500 text-right">
                        {rightEingang ? `Eingang ${rightEingang}` : ""}
                      </div>
                    </div>
                    {(plan.parkettAisleAfterRows ?? []).includes(r.row) && <div className="h-2 w-full flex-shrink-0" aria-hidden />}
                  </div>
                );
              })}
            </div>
            <FoyerBlock label={plan.foyer.label ?? "Fuaye"} />
          </div>
        </div>

        {/* Sağ: Seitensempore Rechts – ilk koltuk Parkett ilk koltuk hizasında */}
        <div className="flex flex-col items-center min-w-0 md:ml-24">
          <div className="w-0 h-[6.5rem] md:h-[7.5rem] mb-1 flex-shrink-0" aria-hidden />
          <div className="mb-0.5 text-sm font-bold text-slate-700 text-center leading-tight">
            {R.labelLines ? R.labelLines.map((line, i) => <span key={i}>{line}{i < R.labelLines!.length - 1 && <br />}</span>) : R.label}
          </div>
          <div className="flex flex-col gap-3 items-center">
            {[0, 1, 2, 3].map((section) => (
              <div key={section} className="flex gap-1 items-start justify-center">
                {rightCounts.map((count, colIndex) => {
                  const rowNum = colIndex + 1;
                  const start = rowNum === 1 ? section * 11 : rowNum === 2 ? section * 10 : section * 9;
                  return (
                    <div key={colIndex} className="flex flex-col gap-0.5 items-center">
                      {Array.from({ length: count }, (_, i) => {
                        const seatNum = start + i + 1;
                        const id = `${R.prefix}-${pad(rowNum)}-${pad(seatNum)}`;
                        return createSeat(id, selectedIds.has(id), onToggle, true, soldIds?.has(id), selectableIds ? !selectableIds.has(id) : false);
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Empore Mitte – eski yeri */}
      <div className="flex flex-wrap justify-center items-start gap-8 md:gap-16 mb-8">
        <div className="flex flex-col items-center">
          <div className="mb-2 text-sm font-bold text-slate-700">{plan.emporeMitteLabels?.left ?? "Empore Mitte Sol"}</div>
          <LinearSection rows={plan.emporeMitte.left.rows} prefix="EML" selectedIds={selectedIds} soldIds={soldIds} selectableIds={selectableIds} onToggle={onToggle} />
        </div>
        <div className="flex flex-col items-center">
          <div className="mb-2 text-sm font-bold text-slate-700">{plan.emporeMitteLabels?.right ?? "Empore Mitte Sağ"}</div>
          <LinearSection rows={plan.emporeMitte.right.rows} prefix="EMR" selectedIds={selectedIds} soldIds={soldIds} selectableIds={selectableIds} onToggle={onToggle} />
        </div>
      </div>

      {/* Empore Hinten */}
      <div className="flex flex-col items-center">
        <div className="mb-2 text-sm font-bold text-slate-700">{plan.emporeHintenLabel ?? "Empore Hinten"}</div>
        <EmporeHintenSection rows={plan.emporeHinten.rows} prefix="EH" selectedIds={selectedIds} soldIds={soldIds} selectableIds={selectableIds} onToggle={onToggle} />
      </div>
    </div>
  );
}
