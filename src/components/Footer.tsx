"use client";

import { useEffect, useState } from "react";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import {
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  Music,
  Send,
  MessageSquare,
  Globe,
  Linkedin,
  Video,
} from "lucide-react";

interface SocialItem {
  platform: string;
  url: string;
}

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

function renderSocialIcon(platform: string) {
  const p = (platform || "").toLowerCase().trim();
  switch (p) {
    case "instagram":
      return <Instagram className="h-5 w-5" />;
    case "facebook":
      return <Facebook className="h-5 w-5" />;
    case "twitter":
    case "x":
      return <Twitter className="h-5 w-5" />;
    case "youtube":
      return <Youtube className="h-5 w-5" />;
    case "spotify":
    case "music":
      return <Music className="h-5 w-5" />;
    case "telegram":
      return <Send className="h-5 w-5" />;
    case "whatsapp":
      return <MessageSquare className="h-5 w-5" />;
    case "linkedin":
      return <Linkedin className="h-5 w-5" />;
    case "tiktok":
      return <Video className="h-5 w-5" />;
    default:
      return <Globe className="h-5 w-5" />;
  }
}

function SocialRow({ className, items }: { className?: string; items: SocialItem[] }) {
  const linkClass = "text-slate-600 hover:text-primary-600 transition-colors";
  if (!items || items.length === 0) return null;

  return (
    <div className={className}>
      {items.map((item, index) => {
        if (!item.url) return null;
        const platformName = item.platform ? item.platform.charAt(0).toUpperCase() + item.platform.slice(1) : "Social";
        return (
          <a
            key={index}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
            aria-label={platformName}
            title={platformName}
          >
            {renderSocialIcon(item.platform)}
          </a>
        );
      })}
    </div>
  );
}

export default function Footer() {
  const t = useTranslations();
  const locale = useLocale();
  const [mounted, setMounted] = useState(false);
  const [socialLinks, setSocialLinks] = useState<SocialItem[]>([
    { platform: "instagram", url: "https://instagram.com/kurdeventofficial" },
    { platform: "facebook", url: "https://www.facebook.com/KurdEventOfficial" },
    { platform: "twitter", url: "https://twitter.com/Kurd_Event" },
    { platform: "youtube", url: "https://youtube.com/@kurdevent" },
  ]);

  useEffect(() => {
    setMounted(true);
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.socialLinks) && data.socialLinks.length > 0) {
          setSocialLinks(data.socialLinks);
        }
      })
      .catch(() => {});
  }, []);

  if (!mounted) return null;

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
                style={{ width: "auto", height: "auto" }}
                priority
              />
            </NextLink>
            <p className="max-w-[260px] text-center text-sm text-slate-600 md:text-left">
              {t("footer.tagline")}
            </p>
            <SocialRow items={socialLinks} className="mt-4 flex flex-wrap items-center justify-center gap-4 md:justify-start" />
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
