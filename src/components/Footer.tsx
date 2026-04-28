"use client";

import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Instagram, Facebook, Twitter, Youtube } from "lucide-react";

const infoMenuLinks = [
  { href: "/bilgilendirme", labelKey: "footer.information" },
  { href: "/bilgilendirme/sss", labelKey: "footer.faq" },
  { href: "/bilgilendirme/organizator-destek", labelKey: "footer.organizerSupport" },
  { href: "/organizator-basvuru", labelKey: "nav.organizerApplication" },
];

const legalMenuLinks = [
  { href: "/bilgilendirme/impressum", labelKey: "footer.impressum" },
  { href: "/bilgilendirme/cerez-politikasi", labelKey: "footer.cookiePolicy" },
  { href: "/bilgilendirme/mesafeli-satis-sozlesmesi", labelKey: "footer.distanceSales" },
  { href: "/bilgilendirme/kullanim-kosullari", labelKey: "footer.terms" },
  { href: "/bilgilendirme/online-odeme-kosullari", labelKey: "footer.onlinePayment" },
  { href: "/bilgilendirme/iade-iptal-politikasi", labelKey: "footer.refundPage" },
  { href: "/bilgilendirme/b2b", labelKey: "footer.b2b" },
];

/** localePrefix: always — /tr/... ; kök + hash: /tr#id */
function hrefWithLocale(locale: string, href: string): string {
  if (href.startsWith("/#")) {
    return `/${locale}#${href.slice(2)}`;
  }
  if (href === "/") return `/${locale}`;
  return `/${locale}${href}`;
}

function SocialRow({ className }: { className?: string }) {
  const linkClass =
    "text-slate-600 hover:text-primary-600 transition-colors";
  return (
    <div className={className}>
      <a
        href="https://instagram.com/kurdeventofficial"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        aria-label="Instagram"
      >
        <Instagram className="h-5 w-5" />
      </a>
      <a
        href="https://www.facebook.com/KurdEventOfficial"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        aria-label="Facebook"
      >
        <Facebook className="h-5 w-5" />
      </a>
      <a
        href="https://twitter.com/Kurd_Event"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        aria-label="Twitter"
      >
        <Twitter className="h-5 w-5" />
      </a>
      <a
        href="https://youtube.com/@kurdevent"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
        aria-label="YouTube"
      >
        <Youtube className="h-5 w-5" />
      </a>
    </div>
  );
}

export default function Footer() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <footer className="border-t border-slate-200/80 bg-slate-50">
      <div className="site-container py-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
          <div className="flex flex-col items-center md:items-start">
            <NextLink
              href={hrefWithLocale(locale, "/")}
              className="mb-2 flex items-center gap-2"
            >
              <Image
                src="/images/kurdevent-logo.png"
                alt="Kurdevent Logo"
                width={300}
                height={90}
                priority
              />
            </NextLink>
            <p className="max-w-[260px] text-center text-sm text-slate-600 md:text-left">
              {t("footer.tagline")}
            </p>
            <SocialRow className="mt-4 flex flex-wrap items-center justify-center gap-4 md:justify-start" />
          </div>

          <div className="flex flex-col items-center md:items-start">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-900">
              {t("footer.menu")}
            </h3>
            <nav className="flex flex-col items-center gap-2 md:items-start">
              {infoMenuLinks.map(({ href, labelKey }) => (
                <NextLink
                  key={href}
                  href={hrefWithLocale(locale, href)}
                  className="text-sm text-slate-600 transition-colors hover:text-primary-600"
                >
                  {t(labelKey)}
                </NextLink>
              ))}
            </nav>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-900">
              {t("footer.legal")}
            </h3>
            <nav className="flex flex-col items-center gap-2 md:items-start">
              {legalMenuLinks.map(({ href, labelKey }) => (
                <NextLink
                  key={href}
                  href={hrefWithLocale(locale, href)}
                  className="text-sm text-slate-600 transition-colors hover:text-primary-600"
                >
                  {t(labelKey)}
                </NextLink>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="site-container py-8">
          <div className="grid grid-cols-1 gap-8 text-xs text-slate-500 md:grid-cols-2 md:gap-12">
            <div className="space-y-4">
              <section id="gonderim-politikasi">
                <strong className="text-slate-700">
                  {t("footer.shippingPolicy")}:
                </strong>{" "}
                {t("footer.shippingPolicyDesc")}
              </section>
              <section id="canli-stok">
                <strong className="text-slate-700">
                  {t("footer.liveStock")}:
                </strong>{" "}
                {t("footer.liveStockDesc")}
              </section>
            </div>
            <div className="space-y-4">
              <section id="iade-politikasi">
                <strong className="text-slate-700">
                  {t("footer.refundPolicy")}:
                </strong>{" "}
                {t("footer.refundPolicyDesc")}
              </section>
              <section id="guvenli-odeme">
                <strong className="text-slate-700">
                  {t("footer.securePayment")}:
                </strong>{" "}
                {t("footer.securePaymentDesc")}
              </section>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="site-container py-4">
          <p className="text-center text-sm font-medium text-slate-600">
            {t("footer.copyright")}
          </p>
        </div>
      </div>
    </footer>
  );
}
