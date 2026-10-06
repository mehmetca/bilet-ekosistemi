"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ChevronDown, HelpCircle } from "lucide-react";

const FAQ_KEYS = [
  "contact",
  "hours",
  "venueAddress",
  "ticketDelivery",
  "noEmailSms",
  "refundChange",
  "studentDiscount",
  "cartTimeout",
  "maxTickets",
  "reservation",
  "boxSeats",
  "multiEvent",
  "printedTicket",
  "serviceFee",
  "childrenTickets",
  "groupDiscount",
  "paymentMethods",
  "lostTicket",
  "wrongEvent",
  "seatSelection",
];

export default function SSSPage() {
  const t = useTranslations("faq");
  const locale = useLocale();
  const dateLocale = locale === "tr" ? "tr-TR" : locale === "de" ? "de-DE" : "en-US";
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="w-full min-w-0">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold-100 text-gold-700">
          <HelpCircle className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-ink-900">{t("title")}</h1>
          <p className="text-sm text-ink-500 mt-1">
            {t("lastUpdated")}: {new Date().toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      <p className="text-ink-700 leading-relaxed mb-8">{t("intro")}</p>

      <div className="space-y-2">
        {FAQ_KEYS.map((key, index) => {
          const q = t(`${key}Q`);
          const a = t(`${key}A`);
          if (!q || q === key + "Q") return null;
          const isOpen = openIndex === index;
          return (
            <div
              key={key}
              className="rounded-lg border border-ink-200 bg-white shadow-card overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-ink-50 transition-colors"
              >
                <span className="font-medium text-ink-900">{q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-ink-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="px-5 pb-4 pt-0">
                  <p className="text-ink-600 leading-relaxed text-sm">{a}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
