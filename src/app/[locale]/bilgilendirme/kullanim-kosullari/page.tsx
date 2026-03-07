"use client";

import { useTranslations, useLocale } from "next-intl";

export default function KullanimKosullariPage() {
  const t = useTranslations("terms");
  const locale = useLocale();
  const dateLocale = locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US";

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 mb-8">
        {t("lastUpdated")}: {new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <div className="prose prose-slate max-w-none space-y-8">
        <section>
          <p className="text-slate-700 leading-relaxed">{t("intro")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("scope")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("scopeDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("account")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("accountDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("use")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("useDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("content")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("contentDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("tickets")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("ticketsDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("liability")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("liabilityDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("termination")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("terminationDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("changes")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("changesDesc")}</p>
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
    </div>
  );
}
