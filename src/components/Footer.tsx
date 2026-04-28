"use client";

import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Instagram, Facebook, Twitter, Youtube } from "lucide-react";


const menuLinks = [
  { href: "/bilgilendirme", labelKey: "footer.information" },
  { href: "/bilgilendirme/sss", labelKey: "footer.faq" },
  { href: "/bilgilendirme/b2b", labelKey: "footer.b2b" },
  { href: "/bilgilendirme/organizator-destek", labelKey: "footer.organizerSupport" },
  { href: "/organizator-basvuru", labelKey: "nav.organizerApplication" },
  { href: "/bilgilendirme/impressum", labelKey: "footer.impressum" },
  { href: "/bilgilendirme/cerez-politikasi", labelKey: "footer.cookiePolicy" },
  { href: "/bilgilendirme/mesafeli-satis-sozlesmesi", labelKey: "footer.distanceSales" },
  { href: "/bilgilendirme/kullanim-kosullari", labelKey: "footer.terms" },
  { href: "/bilgilendirme/online-odeme-kosullari", labelKey: "footer.onlinePayment" },
  { href: "/bilgilendirme/iade-iptal-politikasi", labelKey: "footer.refundPage" },
];

/** localePrefix: always — /tr/... ; kök + hash: /tr#id */
function hrefWithLocale(locale: string, href: string): string {
  if (href.startsWith("/#")) {
    return `/${locale}#${href.slice(2)}`;
  }
  if (href === "/") return `/${locale}`;
  return `/${locale}${href}`;
}

export default function Footer() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-8 md:gap-6">
          <div className="flex flex-col items-center md:items-start">
           
<NextLink
  href={hrefWithLocale(locale, "/")}
  className="flex items-center gap-2 mb-2"
>
  <Image
    src="/images/kurdevent-logo.png"
    alt="Kurdevent Logo"
    width={300}
    height={90}
    priority
  />
</NextLink>

           <p className="text-sm text-slate-600 text-center md:text-left max-w-[220px]">
              {t("footer.tagline")}
            </p>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <h3 className="font-semibold text-slate-900 mb-3 text-sm uppercase tracking-wider">
              {t("footer.menu")}
            </h3>
            <nav className="flex flex-col gap-2">
              {menuLinks.map(({ href, labelKey }) => (
                <NextLink
                  key={href}
                  href={hrefWithLocale(locale, href)}
                  className="text-slate-600 hover:text-primary-600 text-sm transition-colors"
                >
                  {t(labelKey)}
                </NextLink>
              ))}
            </nav>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <div className="space-y-4 text-xs text-slate-500 max-w-md">
              <section id="guvenli-odeme">
                <strong className="text-slate-700">{t("footer.securePayment")}:</strong>{" "}
                {t("footer.securePaymentDesc")}
              </section>
              <section id="iade-politikasi">
                <strong className="text-slate-700">{t("footer.refundPolicy")}:</strong>{" "}
                {t("footer.refundPolicyDesc")}
              </section>
              <section id="gonderim-politikasi">
                <strong className="text-slate-700">{t("footer.shippingPolicy")}:</strong>{" "}
                {t("footer.shippingPolicyDesc")}
              </section>
              <section id="canli-stok">
                <strong className="text-slate-700">{t("footer.liveStock")}:</strong>{" "}
                {t("footer.liveStockDesc")}
              </section>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 mt-8" />


<div className="flex items-center justify-center gap-4 mt-6">
  <a
    href="https://instagram.com/kurdeventofficial"
    target="_blank"
    rel="noopener noreferrer"
    className="text-slate-600 hover:text-primary-600 transition-colors"
  >
    <Instagram className="h-5 w-5" />
  </a>

  <a
    href="https://www.facebook.com/KurdEventOfficial"
    target="_blank"
    rel="noopener noreferrer"
    className="text-slate-600 hover:text-primary-600 transition-colors"
  >
    <Facebook className="h-5 w-5" />
  </a>

  <a
    href="https://twitter.com/Kurd_Event"
    target="_blank"
    rel="noopener noreferrer"
    className="text-slate-600 hover:text-primary-600 transition-colors"
  >
    <Twitter className="h-5 w-5" />
  </a>

  <a
   href="https://youtube.com/@kurdevent"
    target="_blank"
    rel="noopener noreferrer"
    className="text-slate-600 hover:text-primary-600 transition-colors"
  >
    <Youtube className="h-5 w-5" />
  </a>
</div>



      <div className="container mx-auto px-4 py-4">
        <p className="text-sm text-slate-600 font-medium text-center">{t("footer.copyright")}</p>
      </div>
    </footer>
  );
}
