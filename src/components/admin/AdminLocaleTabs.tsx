"use client";

const LOCALES = [
  { key: "tr" as const, label: "Türkçe" },
  { key: "de" as const, label: "Deutsch" },
  { key: "en" as const, label: "English" },
] as const;

interface AdminLocaleSectionProps {
  locale: "tr" | "de" | "en";
  label: string;
  children: React.ReactNode;
}

export function AdminLocaleSection({ locale, label, children }: AdminLocaleSectionProps) {
  const locLabel = LOCALES.find((l) => l.key === locale)?.label ?? locale;
  return (
    <div className="rounded-lg border border-slate-200 p-4 bg-slate-50/50">
      <h4 className="text-sm font-semibold text-slate-700 mb-3">
        {label} ({locLabel})
      </h4>
      {children}
    </div>
  );
}

export default function AdminLocaleTabs({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

export { LOCALES };
