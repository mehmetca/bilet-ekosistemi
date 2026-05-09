"use client";

import { EVENT_TICKET_TYPE_PRESET_LABELS } from "@/lib/ticket-type-presets";

type Props = {
  value: string;
  onChange: (next: string) => void;
  allowEmpty?: boolean;
  className?: string;
  id?: string;
};

export default function TicketTypeLabelSelect({
  value,
  onChange,
  allowEmpty = true,
  className,
  id,
}: Props) {
  const trimmed = String(value ?? "").trim();
  const presetSet = new Set(EVENT_TICKET_TYPE_PRESET_LABELS);
  const isPreset = trimmed !== "" && presetSet.has(trimmed);
  const selectValue = trimmed === "" ? "" : isPreset ? trimmed : "__custom__";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        id={id}
        className={className ?? "rounded border border-slate-300 bg-white px-2 py-1.5 text-sm min-w-[12rem] max-w-full"}
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") onChange(trimmed);
          else onChange(v);
        }}
      >
        {allowEmpty && <option value="">— Yok —</option>}
        {EVENT_TICKET_TYPE_PRESET_LABELS.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
        <option value="__custom__">Özel (elle yazın)…</option>
      </select>
      {selectValue === "__custom__" && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="tickets.name ile aynı yazın"
          className="rounded border border-slate-300 px-2 py-1.5 text-sm w-56 max-w-full"
        />
      )}
    </div>
  );
}
