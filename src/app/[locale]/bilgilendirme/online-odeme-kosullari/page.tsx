"use client";

import { useTranslations, useLocale } from "next-intl";

export default function OnlineOdemeKosullariPage() {
  const t = useTranslations("onlinePayment");
  const locale = useLocale();
  const dateLocale = locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US";

  return (
    <div className="w-full min-w-0">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 mb-8">
        {t("lastUpdated")}:{" "}
        {new Date().toLocaleDateString(dateLocale, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      <div className="prose prose-slate max-w-none space-y-8">
        <section>
          <p className="text-slate-700 leading-relaxed">{t("intro")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("methods")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("methodsDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("security")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("securityDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("authorization")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("authorizationDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("fees")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("feesDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("refunds")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("refundsDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("chargebacks")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("chargebacksDesc")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("contact")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("contactDesc")}</p>
        </section>
      </div>
    </div>
  );
}

