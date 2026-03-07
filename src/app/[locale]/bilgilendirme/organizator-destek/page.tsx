"use client";

import { useTranslations, useLocale } from "next-intl";
import { Calendar, FileText, CheckCircle, Lock, List } from "lucide-react";

export default function OrganizatorDestekPage() {
  const t = useTranslations("organizerSupport");
  const locale = useLocale();
  const dateLocale = locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US";

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
          <FileText className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t("title")}</h1>
          <p className="text-sm text-slate-500 mt-1">{t("subtitle")}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {t("lastUpdated")}: {new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      <p className="text-slate-700 leading-relaxed mb-8">{t("intro")}</p>

      {/* Etkinlik Nasıl Eklenir */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary-600" />
          {t("howToAddEvents.title")}
        </h2>
        <ol className="list-decimal list-inside space-y-3 text-slate-700">
          <li>{t("howToAddEvents.step1")}</li>
          <li>{t("howToAddEvents.step2")}</li>
          <li>{t("howToAddEvents.step3")}</li>
          <li>{t("howToAddEvents.step4")}</li>
          <li>{t("howToAddEvents.step5")}</li>
          <li>{t("howToAddEvents.step6")}</li>
        </ol>
      </section>

      {/* Onay Süreci */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-amber-600" />
          {t("approvalProcess.title")}
        </h2>
        <div className="space-y-3 text-slate-700">
          <p>{t("approvalProcess.desc")}</p>
          <p className="font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            {t("approvalProcess.pending")}
          </p>
          <p>{t("approvalProcess.approved")}</p>
          <p className="text-sm text-slate-600">{t("approvalProcess.patience")}</p>
        </div>
      </section>

      {/* Bilgileri Tamamlayın */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary-600" />
          {t("completeInfo.title")}
        </h2>
        <div className="space-y-3 text-slate-700">
          <p>{t("completeInfo.desc")}</p>
          <p>{t("completeInfo.required")}</p>
          <p>{t("completeInfo.where")}</p>
          <p className="font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg p-3">
            {t("completeInfo.tip")}
          </p>
        </div>
      </section>

      {/* Değiştirilebilir / Değiştirilemez */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">{t("editableInfo.title")}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-green-200 bg-green-50 p-5">
            <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {t("editableInfo.editable.title")}
            </h3>
            <p className="text-sm text-green-800 mb-2">{t("editableInfo.editable.desc")}</p>
            <p className="text-sm text-green-900">{t("editableInfo.editable.items")}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              {t("editableInfo.readOnly.title")}
            </h3>
            <p className="text-sm text-slate-700 mb-2">{t("editableInfo.readOnly.desc")}</p>
            <p className="text-sm text-slate-800">{t("editableInfo.readOnly.items")}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-600 italic">{t("editableInfo.profileNote")}</p>
      </section>

      {/* Özet */}
      <section>
        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <List className="h-5 w-5 text-primary-600" />
          {t("summary.title")}
        </h2>
        <ul className="space-y-2 text-slate-700">
          <li className="flex items-start gap-2">
            <span className="text-primary-600 font-bold">1.</span>
            {t("summary.list1")}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-600 font-bold">2.</span>
            {t("summary.list2")}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-600 font-bold">3.</span>
            {t("summary.list3")}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-600 font-bold">4.</span>
            {t("summary.list4")}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-600 font-bold">5.</span>
            {t("summary.list5")}
          </li>
        </ul>
      </section>
    </div>
  );
}
