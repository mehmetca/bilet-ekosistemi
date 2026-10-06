"use client";

import { Link } from "@/i18n/navigation";
import { Search as SearchIcon } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useHomeSearch } from "@/contexts/HomeSearchContext";
import { buttonClass } from "@/components/ui/Button";

export default function HomeHeroControls() {
  const t = useTranslations("home");
  const locale = useLocale();
  const { searchTerm, setSearchTerm } = useHomeSearch();
  const ctaText = locale === "tr" ? "Ara" : t("search");

  return (
    <div className="mt-10 max-w-2xl md:mt-12">
      <div className="flex flex-col gap-2 rounded-md border border-ink-200 bg-white/95 p-2 shadow-card transition-shadow focus-within:ring-2 focus-within:ring-gold-500/60 sm:flex-row sm:items-stretch">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-12 w-full rounded-md border-0 bg-transparent pl-11 pr-3 text-base text-ink-900 placeholder:text-ink-500 focus:outline-none focus:ring-0"
          />
        </div>
        <Link
          href={searchTerm.trim() ? `/arama?q=${encodeURIComponent(searchTerm.trim())}` : "/arama"}
          className={buttonClass({
            variant: "gold",
            size: "lg",
            className: "w-full shrink-0 sm:w-auto",
          })}
        >
          {ctaText}
        </Link>
      </div>
    </div>
  );
}
