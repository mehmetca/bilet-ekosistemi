"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

const CONSENT_KEY = "cookie_consent";

type ConsentStatus = "accepted" | "declined" | null;

export default function CookieConsent() {
  const t = useTranslations("cookieConsent");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(CONSENT_KEY) as ConsentStatus | null;
    if (stored === null) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-ink-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
      role="dialog"
      aria-label="Çerez onayı"
    >
      <div className="site-container max-w-4xl pt-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-sm text-ink-700 flex-1">
            {t("message")}{" "}
            <Link href="/bilgilendirme/cerez-politikasi" className="text-gold-700 hover:text-gold-700 font-medium underline">
              {t("learnMore")}
            </Link>
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-sm font-medium text-ink-600 hover:text-ink-800 hover:bg-ink-100 rounded-lg transition-colors"
            >
              {t("decline")}
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2 text-sm font-medium text-ink-950 bg-gold-500 hover:bg-gold-400 rounded-lg transition-colors"
            >
              {t("accept")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
