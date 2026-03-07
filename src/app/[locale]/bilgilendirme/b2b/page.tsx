"use client";

import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Building2, Megaphone, Award, ArrowRight, FileEdit } from "lucide-react";

const B2B_SECTIONS = [
  { id: "organizatorler", labelKey: "organizers.title", icon: Building2 },
  { id: "reklamverenler", labelKey: "advertisers.title", icon: Megaphone },
  { id: "etkinlik-sponsorlari", labelKey: "sponsors.title", icon: Award },
] as const;

export default function B2BPage() {
  const t = useTranslations("b2b");
  const locale = useLocale();
  const dateLocale = locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US";

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      {/* Sol menü - Masaüstü */}
      <aside className="hidden lg:block lg:w-56 shrink-0 order-2 lg:order-1">
        <nav className="sticky top-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">
            {t("title")}
          </h2>
          <ul className="space-y-1">
            {B2B_SECTIONS.map(({ id, labelKey, icon: Icon }) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-primary-600 transition-colors"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(labelKey)}
                </a>
              </li>
            ))}
            <li className="pt-2 mt-2 border-t border-slate-200">
              <Link
                href="/organizator-basvuru"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-primary-600 transition-colors"
              >
                <FileEdit className="h-4 w-4 shrink-0" />
                {t("organizers.menuOrganizerApplication")}
              </Link>
            </li>
          </ul>
        </nav>
      </aside>

      {/* İçerik */}
      <div className="flex-1 min-w-0 max-w-3xl order-1 lg:order-2">
        {/* Üst bilgi - tüm bölümlerin üstünde */}
        <div className="mb-6 lg:mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{t("title")}</h1>
          <p className="text-sm text-slate-500 mb-4">
            {t("lastUpdated")}: {new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" })}
          </p>
          <p className="text-slate-700 leading-relaxed">{t("intro")}</p>
        </div>

        {/* Mobil: Bölüm linkleri - yatay, dokunmaya uygun */}
        <nav className="lg:hidden mb-6 flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" aria-label={t("title")}>
          {B2B_SECTIONS.map(({ id, labelKey, icon: Icon }) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap bg-slate-100 text-slate-700 hover:bg-primary-100 hover:text-primary-700 active:bg-primary-200 transition-colors shrink-0"
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t(labelKey)}
            </a>
          ))}
          <NextLink
            href="/organizator-basvuru"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap bg-primary-100 text-primary-700 hover:bg-primary-200 active:bg-primary-300 transition-colors shrink-0"
          >
            <FileEdit className="h-4 w-4 shrink-0" />
            {t("organizers.menuOrganizerApplication")}
          </NextLink>
        </nav>

        {/* Organizatörler */}
        <section id="organizatorler" className="mb-12 scroll-mt-20 lg:scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
              <Building2 className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{t("organizers.title")}</h2>
          </div>
          <div className="prose prose-slate max-w-none space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("organizers.registration")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("organizers.registrationDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("organizers.contract")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("organizers.contractDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("organizers.use")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("organizers.useDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("organizers.services")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("organizers.servicesDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("organizers.duties")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("organizers.dutiesDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("organizers.ddgInfo")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-3">{t("organizers.ddgInfoDesc")}</p>
              <ul className="text-slate-600 text-sm list-disc list-inside space-y-1">
                <li>{t("organizers.ddgInfo1")}</li>
                <li>{t("organizers.ddgInfo2")}</li>
                <li>{t("organizers.ddgInfo3")}</li>
                <li>{t("organizers.ddgInfo4")}</li>
                <li>{t("organizers.ddgInfo5")}</li>
                <li>{t("organizers.ddgInfo6")}</li>
                <li>{t("organizers.ddgInfo7")}</li>
              </ul>
              <p className="text-slate-600 text-sm mt-3">{t("organizers.ddgInfoHow")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("organizers.fees")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("organizers.feesDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("organizers.settlement")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("organizers.settlementDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("organizers.disruption")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("organizers.disruptionDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("organizers.liability")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("organizers.liabilityDesc")}</p>
            </div>
            <div className="rounded-lg border-2 border-primary-200 bg-primary-50 p-5">
              <h3 className="font-semibold text-slate-900 mb-2">{t("organizers.applyCTA")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">{t("organizers.applyCTADesc")}</p>
              <Link
                href="/organizator-basvuru"
                className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-semibold text-sm"
              >
                {t("organizers.applyCTAButton")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Reklamverenler */}
        <section id="reklamverenler" className="mb-12 scroll-mt-20 lg:scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Megaphone className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{t("advertisers.title")}</h2>
          </div>
          <div className="prose prose-slate max-w-none space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("advertisers.eligibility")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("advertisers.eligibilityDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("advertisers.content")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("advertisers.contentDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("advertisers.pricing")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("advertisers.pricingDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("advertisers.terms")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("advertisers.termsDesc")}</p>
            </div>
          </div>
        </section>

        {/* Etkinlik Sponsorları */}
        <section id="etkinlik-sponsorlari" className="mb-8 scroll-mt-20 lg:scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <Award className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{t("sponsors.title")}</h2>
          </div>
          <div className="prose prose-slate max-w-none space-y-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("sponsors.overview")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("sponsors.overviewDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("sponsors.branding")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("sponsors.brandingDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("sponsors.contract")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("sponsors.contractDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900 mb-2">{t("sponsors.contact")}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{t("sponsors.contactDesc")}</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 mt-8">
          <h3 className="font-semibold text-slate-900 mb-2">{t("contact")}</h3>
          <p className="text-slate-600 text-sm leading-relaxed">{t("contactDesc")}</p>
        </section>
      </div>
    </div>
  );
}
