import { useTranslations } from "next-intl";

/** Kartlarda kısa tükendi etiketi: Türkçe "TÜKENDİ", diğer dillerde "SOLD OUT". */
export default function EventSoldOutBadge({ className = "" }: { className?: string }) {
  const t = useTranslations("eventDetail");
  return (
    <span
      className={`inline-block rounded bg-red-600 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white ${className}`}
    >
      {t("soldOutCta")}
    </span>
  );
}
