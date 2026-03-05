"use client";

import Header from "@/components/Header";
import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft } from "lucide-react";

export default function MesafeliSatisSozlesmesiPage() {
  const t = useTranslations("distanceSales");
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
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("parties")}</h2>
            <p className="text-slate-700 leading-relaxed">{t("partiesDesc")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("subject")}</h2>
            <p className="text-slate-700 leading-relaxed">{t("subjectDesc")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("contract")}</h2>
            <p className="text-slate-700 leading-relaxed">{t("contractDesc")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("price")}</h2>
            <p className="text-slate-700 leading-relaxed">{t("priceDesc")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("delivery")}</h2>
            <p className="text-slate-700 leading-relaxed">{t("deliveryDesc")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("withdrawal")}</h2>
            <p className="text-slate-700 leading-relaxed">{t("withdrawalDesc")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("warranty")}</h2>
            <p className="text-slate-700 leading-relaxed">{t("warrantyDesc")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("liability")}</h2>
            <p className="text-slate-700 leading-relaxed">{t("liabilityDesc")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("law")}</h2>
            <p className="text-slate-700 leading-relaxed">{t("lawDesc")}</p>
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
