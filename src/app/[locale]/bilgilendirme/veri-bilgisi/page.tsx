"use client";

import { useTranslations, useLocale } from "next-intl";

export default function VeriBilgisiPage() {
  const t = useTranslations("information");
  const locale = useLocale();
  const dateLocale = locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US";

  return (
    <div className="w-full min-w-0">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 mb-8">
        {t("lastUpdated")}: {new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <div className="prose prose-slate max-w-none space-y-8">
        <section>
          <p className="text-slate-700 leading-relaxed">{t("intro")}</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">{t("dataProtection")}</h2>
          <p className="text-slate-700 leading-relaxed mb-4">{t("dataProtectionIntro")}</p>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-medium text-slate-900 mb-2">{t("controller")}</h3>
              <p className="text-slate-600 text-sm">{t("controllerDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-medium text-slate-900 mb-2">{t("dataCollected")}</h3>
              <p className="text-slate-600 text-sm">{t("dataCollectedDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-medium text-slate-900 mb-2">{t("legalBasis")}</h3>
              <p className="text-slate-600 text-sm">{t("legalBasisDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-medium text-slate-900 mb-2">{t("retention")}</h3>
              <p className="text-slate-600 text-sm">{t("retentionDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-medium text-slate-900 mb-2">{t("rights")}</h3>
              <p className="text-slate-600 text-sm">{t("rightsDesc")}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">{t("preContract")}</h2>
          <p className="text-slate-700 leading-relaxed mb-4">{t("preContractIntro")}</p>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-medium text-slate-900 mb-2">{t("seller")}</h3>
              <p className="text-slate-600 text-sm">{t("sellerDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-medium text-slate-900 mb-2">{t("product")}</h3>
              <p className="text-slate-600 text-sm">{t("productDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-medium text-slate-900 mb-2">{t("payment")}</h3>
              <p className="text-slate-600 text-sm">{t("paymentDesc")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="font-medium text-slate-900 mb-2">{t("withdrawal")}</h3>
              <p className="text-slate-600 text-sm">{t("withdrawalDesc")}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-slate-900 mb-3">{t("contact")}</h2>
          <p className="text-slate-700 leading-relaxed">{t("contactDesc")}</p>
        </section>
      </div>
    </div>
  );
}
