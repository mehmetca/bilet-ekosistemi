"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Ticket } from "lucide-react";

const menuLinks = [
  { href: "/impressum", labelKey: "footer.impressum" },
  { href: "/bilgilendirme", labelKey: "footer.information" },
  { href: "/cerez-politikasi", labelKey: "footer.cookiePolicy" },
  { href: "/mesafeli-satis-sozlesmesi", labelKey: "footer.distanceSales" },
  { href: "/kullanim-kosullari", labelKey: "footer.terms" },
];

const policyLinks = [
  { href: "/#guvenli-odeme", labelKey: "footer.securePayment" },
  { href: "/#iade-politikasi", labelKey: "footer.refundPolicy" },
  { href: "/#gonderim-politikasi", labelKey: "footer.shippingPolicy" },
  { href: "/#canli-stok", labelKey: "footer.liveStock" },
];

export default function Footer() {
  const t = useTranslations();
  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-8 md:gap-6">
          {/* Bölüm 1: Logo + Site adı + Tagline */}
          <div className="flex flex-col items-center md:items-start">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary-600 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white shrink-0">
                <Ticket className="h-5 w-5" />
              </div>
              <span>{t("footer.siteName")}</span>
            </Link>
            <p className="text-sm text-slate-600 text-center md:text-left max-w-[220px]">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Bölüm 2: Menüler */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="font-semibold text-slate-900 mb-3 text-sm uppercase tracking-wider">
              {t("footer.menu")}
            </h3>
            <nav className="flex flex-col gap-2">
              {menuLinks.map(({ href, labelKey }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-slate-600 hover:text-primary-600 text-sm transition-colors"
                >
                  {t(labelKey)}
                </Link>
              ))}
            </nav>
          </div>

          {/* Bölüm 3: Politika linkleri (üstte) + açıklama metinleri */}
          <div className="flex flex-col items-center md:items-start">
            {/* Güvenli Ödeme, İade Politikası vb. linkler - yazıların üstünde */}
            <div className="flex flex-wrap gap-4 text-sm mb-4">
              {policyLinks.map(({ href, labelKey }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-slate-600 hover:text-primary-600 font-medium"
                >
                  {t(labelKey)}
                </Link>
              ))}
            </div>
            <div className="space-y-4 text-xs text-slate-500 max-w-md">
              <section id="guvenli-odeme">
                <strong className="text-slate-700">{t("footer.securePayment")}:</strong> {t("footer.securePaymentDesc")}
              </section>
              <section id="iade-politikasi">
                <strong className="text-slate-700">{t("footer.refundPolicy")}:</strong> {t("footer.refundPolicyDesc")}
              </section>
              <section id="gonderim-politikasi">
                <strong className="text-slate-700">{t("footer.shippingPolicy")}:</strong> {t("footer.shippingPolicyDesc")}
              </section>
              <section id="canli-stok">
                <strong className="text-slate-700">{t("footer.liveStock")}:</strong> {t("footer.liveStockDesc")}
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Tam sayfa çizgi - boydan boya */}
      <div className="border-t border-slate-200 mt-8" />

      {/* Copyright en altta */}
      <div className="container mx-auto px-4 py-4">
        <p className="text-sm text-slate-600 font-medium text-center">{t("footer.copyright")}</p>
      </div>
    </footer>
  );
}
