"use client";

import Header from "@/components/Header";
import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft } from "lucide-react";

export default function ImpressumPage() {
  const t = useTranslations("impressum");
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
          {new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <div className="prose prose-slate max-w-none space-y-6">
          <section>
            <p className="text-slate-700 leading-relaxed">{t("intro")}</p>
          </section>

          <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{t("company")}</h3>
              <p className="text-slate-900 font-medium">{t("companyName")}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{t("address")}</h3>
              <p className="text-slate-700 whitespace-pre-line">{t("addressValue")}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{t("registration")}</h3>
              <p className="text-slate-700">{t("registrationValue")}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{t("vatId")}</h3>
              <p className="text-slate-700">{t("vatIdValue")}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{t("contact")}</h3>
              <p className="text-slate-700">
                {t("email")}: {t("emailValue")}
              </p>
              <p className="text-slate-700 mt-1">
                {t("phone")}: {t("phoneValue")}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">{t("responsible")}</h3>
              <p className="text-slate-700">{t("responsibleValue")}</p>
            </div>
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">{t("dispute")}</h3>
            <p className="text-slate-700 text-sm">{t("disputeDesc")}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
