"use client";

import { useTranslations, useLocale } from "next-intl";

export default function ImpressumPage() {
  const t = useTranslations("impressum");
  const locale = useLocale();
  const dateLocale = locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US";

  return (
    <div className="w-full min-w-0">
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
            <p className="text-slate-700">{t("email")}: hallo@kurdevents.org</p>
            <p className="text-slate-700">{t("email")}: eventseat21@gmail.com</p>
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
    </div>
  );
}
