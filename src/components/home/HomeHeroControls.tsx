"use client";

import { Link } from "@/i18n/navigation";
import {
  Search as SearchIcon,
  CheckCircle,
  Shield,
  Clock,
  Database,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { useHomeSearch } from "@/contexts/HomeSearchContext";

export default function HomeHeroControls() {
  const t = useTranslations("home");
  const locale = useLocale();
  const { searchTerm, setSearchTerm } = useHomeSearch();
  const ctaText = locale === "tr" ? "Ara" : t("search");

  return (
    <>
      <div className="max-w-2xl mx-auto mb-12 sm:mb-16 px-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 bg-white rounded-2xl p-2 shadow-2xl">
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="absolute left-3 sm:left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border-0 py-3.5 sm:py-4 pl-11 sm:pl-12 pr-3 sm:pr-4 text-slate-900 text-base sm:text-lg focus:outline-none"
            />
          </div>
          <Link
            href={searchTerm.trim() ? `/arama?q=${encodeURIComponent(searchTerm.trim())}` : "/arama"}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-primary-600 px-6 sm:px-8 py-3.5 sm:py-4 font-semibold text-white hover:bg-primary-700 transition-colors text-center shrink-0"
          >
            {ctaText}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
        <div className="text-center">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 text-white" />
          </div>
          <h2 className="font-semibold text-base mb-2 text-white">{t("trustBadges.verified")}</h2>
          <p className="text-sm text-white/90">{t("trustBadges.verifiedDesc")}</p>
        </div>
        <div className="text-center">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
            <Clock className="h-10 w-10 mx-auto mb-3 text-white" />
          </div>
          <h2 className="font-semibold text-base mb-2 text-white">{t("trustBadges.delivery")}</h2>
          <p className="text-sm text-white/90">{t("trustBadges.deliveryDesc")}</p>
        </div>
        <div className="text-center">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
            <Shield className="h-10 w-10 mx-auto mb-3 text-white" />
          </div>
          <h2 className="font-semibold text-base mb-2 text-white">{t("trustBadges.payment")}</h2>
          <p className="text-sm text-white/90">{t("trustBadges.paymentDesc")}</p>
        </div>
        <div className="text-center">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 mb-4">
            <Database className="h-10 w-10 mx-auto mb-3 text-white" />
          </div>
          <h2 className="font-semibold text-base mb-2 text-white">{t("trustBadges.inventory")}</h2>
          <p className="text-sm text-white/90">{t("trustBadges.inventoryDesc")}</p>
        </div>
      </div>

      <ul
        className="mt-10 flex flex-wrap items-center justify-center gap-2 text-xs list-none p-0 m-0"
        aria-label={t("paymentMethodsLabel")}
      >
        {["VISA", "Mastercard", "AMEX", "Apple Pay", "Google Pay", "3D Secure"].map((badge) => (
          <li
            key={badge}
            className="rounded-full border border-white/40 bg-white/10 px-3 py-2 text-white/95"
          >
            {badge}
          </li>
        ))}
      </ul>
    </>
  );
}
