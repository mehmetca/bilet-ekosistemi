"use client";

import Header from "@/components/Header";
import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft } from "lucide-react";

export default function CerezPolitikasiPage() {
  const t = useTranslations("cookies");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateLocale = locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US";

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-600 hover:text-primary-600 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {tCommon("backToHome")}
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">{t("title")}</h1>
        <p className="text-sm text-slate-500 mb-8">
          {t("lastUpdated")}: {new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <p className="text-slate-700 leading-relaxed">{t("intro")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("whatAre")}</h2>
            <p className="text-slate-700 leading-relaxed">{t("whatAreDesc")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">{t("types")}</h2>
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="font-medium text-slate-900 mb-2">{t("necessary")}</h3>
                <p className="text-slate-600 text-sm">{t("necessaryDesc")}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="font-medium text-slate-900 mb-2">{t("functional")}</h3>
                <p className="text-slate-600 text-sm">{t("functionalDesc")}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="font-medium text-slate-900 mb-2">{t("analytics")}</h3>
                <p className="text-slate-600 text-sm">{t("analyticsDesc")}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("yourRights")}</h2>
            <p className="text-slate-700 leading-relaxed">{t("yourRightsDesc")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("contact")}</h2>
            <p className="text-slate-700 leading-relaxed">{t("contactDesc")}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
