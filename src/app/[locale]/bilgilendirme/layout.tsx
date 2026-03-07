"use client";

import Header from "@/components/Header";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, HelpCircle, FileText, Scale, Building2, Users } from "lucide-react";

const MENU_ITEMS = [
  { href: "/bilgilendirme/sss", labelKey: "footer.faq", icon: HelpCircle },
  { href: "/bilgilendirme/veri-bilgisi", labelKey: "footer.information", icon: FileText },
  { href: "/bilgilendirme/impressum", labelKey: "footer.impressum", icon: FileText },
  { href: "/bilgilendirme/cerez-politikasi", labelKey: "footer.cookiePolicy", icon: FileText },
  { href: "/bilgilendirme/mesafeli-satis-sozlesmesi", labelKey: "footer.distanceSales", icon: Scale },
  { href: "/bilgilendirme/kullanim-kosullari", labelKey: "footer.terms", icon: Scale },
];

const B2B_MENU_ITEM = { href: "/bilgilendirme/b2b", labelKey: "footer.b2b", icon: Building2 };
const ORGANIZATOR_DESTEK_ITEM = { href: "/bilgilendirme/organizator-destek", labelKey: "footer.organizerSupport", icon: Users };

export default function BilgilendirmeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const isB2BPage = pathname?.includes("/b2b");

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="container mx-auto px-4 py-6">
        <Link
          href={isB2BPage ? "/bilgilendirme" : "/"}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-primary-600 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {isB2BPage ? t("infoMenu.backToInfo") : t("common.backToHome")}
        </Link>

        {isB2BPage ? (
          /* B2B sayfası: Kendi menüsü var, parent menü gösterilmez */
          <main>{children}</main>
        ) : (
          <div className="flex flex-col md:flex-row gap-8">
            {/* Sol menü - Bilgilendirme & Sözleşmeler */}
            <aside className="w-full md:w-64 shrink-0">
              <nav className="sticky top-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 px-2">
                  {t("infoMenu.title")}
                </h2>
                <ul className="space-y-1">
                  {MENU_ITEMS.map(({ href, labelKey, icon: Icon }) => {
                    const segment = href.split("/").pop() || "";
                    const isActive = pathname === href || pathname?.endsWith("/" + segment);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-primary-50 text-primary-700"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {t(labelKey)}
                        </Link>
                      </li>
                    );
                  })}
                  <li className="pt-2 mt-2 border-t border-slate-200">
                    <Link
                      href={ORGANIZATOR_DESTEK_ITEM.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        pathname === ORGANIZATOR_DESTEK_ITEM.href || pathname?.endsWith("/organizator-destek")
                          ? "bg-primary-50 text-primary-700"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <ORGANIZATOR_DESTEK_ITEM.icon className="h-4 w-4 shrink-0" />
                      {t(ORGANIZATOR_DESTEK_ITEM.labelKey)}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={B2B_MENU_ITEM.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        pathname === B2B_MENU_ITEM.href || pathname?.endsWith("/b2b")
                          ? "bg-primary-50 text-primary-700"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <B2B_MENU_ITEM.icon className="h-4 w-4 shrink-0" />
                      {t(B2B_MENU_ITEM.labelKey)}
                    </Link>
                  </li>
                </ul>
              </nav>
            </aside>

            {/* İçerik alanı */}
            <main className="flex-1 min-w-0">{children}</main>
          </div>
        )}
      </div>
    </div>
  );
}
