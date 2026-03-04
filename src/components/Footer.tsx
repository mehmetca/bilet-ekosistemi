"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

const policyLinks = [
  { href: "/#guvenli-odeme", labelKey: "footer.securePayment" },
  { href: "/#iade-politikasi", labelKey: "footer.refundPolicy" },
  { href: "/#gonderim-politikasi", labelKey: "footer.shippingPolicy" },
  { href: "/#canli-stok", labelKey: "footer.liveStock" },
];

export default function Footer() {
  const t = useTranslations();
  return (
    <footer className="border-t border-slate-200 bg-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm mb-4">
          {policyLinks.map(({ href, labelKey }) => (
            <Link
              key={href}
              href={href}
              className="text-slate-600 hover:text-primary-600"
            >
              {t(labelKey)}
            </Link>
          ))}
        </div>
        <div className="space-y-4 text-center text-xs text-slate-500 max-w-2xl mx-auto">
          <section id="guvenli-odeme">
            <strong>{t("footer.securePayment")}:</strong> {t("footer.securePaymentDesc")}
          </section>
          <section id="iade-politikasi">
            <strong>{t("footer.refundPolicy")}:</strong> {t("footer.refundPolicyDesc")}
          </section>
          <section id="gonderim-politikasi">
            <strong>{t("footer.shippingPolicy")}:</strong> {t("footer.shippingPolicyDesc")}
          </section>
          <section id="canli-stok">
            <strong>{t("footer.liveStock")}:</strong> {t("footer.liveStockDesc")}
          </section>
        </div>
        <div className="text-center text-sm text-slate-500 mt-6" suppressHydrationWarning>
          {t("footer.copyright", { year: new Date().getFullYear() })}
        </div>
      </div>
    </footer>
  );
}
