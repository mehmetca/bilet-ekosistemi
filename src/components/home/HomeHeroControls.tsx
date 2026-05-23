"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import {
  Search as SearchIcon,
  CheckCircle,
  Shield,
  Clock,
  Database,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

const DEFAULT_TR_VARIANT = {
  variant: "A",
  hero_title: "Hayalinizdeki Etkinliğe Bilet Bulun",
  hero_subtitle:
    "Konser, tiyatro, stand-up ve daha fazlası.\nGüvenli ödeme ile kolayca bilet alın.",
  cta_text: "Ara",
};

type HomeHeroControlsProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
};

export default function HomeHeroControls({
  searchTerm,
  onSearchTermChange,
}: HomeHeroControlsProps) {
  const t = useTranslations("home");
  const locale = useLocale();
  const [heroVariant, setHeroVariant] = useState<{
    variant: string;
    hero_title: string;
    hero_subtitle: string;
    cta_text: string;
  } | null>(locale === "tr" ? DEFAULT_TR_VARIANT : null);

  useEffect(() => {
    if (locale !== "tr") return;
    const key = "hero_ab_variant";

    try {
      const cached = sessionStorage.getItem(key);
      if (cached) {
        setHeroVariant(JSON.parse(cached) as typeof DEFAULT_TR_VARIANT);
        return;
      }
    } catch {
      /* ignore */
    }

    const loadVariant = () => {
      fetch("/api/ab/variant")
        .then(async (r) => {
          if (!r.ok) throw new Error("Variant fetch failed");
          return r.json();
        })
        .then((data) => {
          if (!data || typeof data !== "object") return;
          const v = {
            variant: data.variant || "A",
            hero_title: data.hero_title || DEFAULT_TR_VARIANT.hero_title,
            hero_subtitle: data.hero_subtitle || DEFAULT_TR_VARIANT.hero_subtitle,
            cta_text: data.cta_text || DEFAULT_TR_VARIANT.cta_text,
          };
          setHeroVariant(v);
          try {
            sessionStorage.setItem(key, JSON.stringify(v));
          } catch {
            /* ignore */
          }
        })
        .catch(() => setHeroVariant(DEFAULT_TR_VARIANT));
    };

    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(loadVariant, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(loadVariant, 1);
    return () => window.clearTimeout(t);
  }, [locale]);

  const heroTitle =
    locale === "tr" && heroVariant?.hero_title ? heroVariant.hero_title : t("heroTitle");
  const heroSubtitle =
    locale === "tr" && heroVariant?.hero_subtitle
      ? heroVariant.hero_subtitle
      : t("heroSubtitle");
  const ctaText =
    locale === "tr" && heroVariant?.cta_text ? heroVariant.cta_text : t("search");

  return (
    <div className="relative z-10 site-container text-center">
      <h1 className="mb-6 px-1 text-white break-words hyphens-auto">
        <span className="block text-3xl font-bold sm:text-4xl md:text-6xl">{heroTitle}</span>
        <span className="mt-3 block text-lg font-semibold leading-snug text-white/95 sm:text-xl md:text-2xl">
          {t("seoH1")}
        </span>
      </h1>
      <p className="text-base sm:text-lg md:text-xl text-white mb-8 sm:mb-12 max-w-3xl mx-auto px-1 whitespace-pre-line">
        {heroSubtitle}
      </p>

      <div className="max-w-2xl mx-auto mb-12 sm:mb-16 px-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 bg-white rounded-2xl p-2 shadow-2xl">
          <div className="relative flex-1 min-w-0">
            <SearchIcon className="absolute left-3 sm:left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder={t("searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
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
    </div>
  );
}
