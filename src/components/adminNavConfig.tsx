import {
  Calendar,
  Ticket,
  Users,
  Settings,
  Shield,
  CreditCard,
  BarChart3,
  User,
  Megaphone,
  MapPin,
  Bell,
  LayoutGrid,
  PieChart,
  Image as ImageIcon,
  Palette,
  FileText,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Yönetim menüsünün tek kaynağı. Hem sol menü (gruplu) hem panel ortasındaki
 * kısayol kartları buradan üretilir; yeni sayfa eklerken yalnız bu dosya değişir.
 *
 * Etiketi `t("nav.*")` ile gelen maddelerde `labelKey` dolu, sabit Türkçe
 * başlıklarda `label` kullanılır.
 */
export type AdminNavItem = {
  href: string;
  icon: LucideIcon;
  labelKey?: string;
  label?: string;
  descriptionKey?: string;
  description?: string;
};

export type AdminNavGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: "general",
    label: "Genel",
    icon: Calendar,
    items: [
      { href: "/yonetim", labelKey: "nav.dashboard", icon: Calendar, descriptionKey: "nav.dashboardDescAdmin" },
      { href: "/yonetim/akis", label: "Canlı akış", icon: Bell, description: "Sipariş, gişe, mail, fatura, üyelik ve yönetici işlemleri" },
    ],
  },
  {
    key: "events",
    label: "Etkinlik & Mekân",
    icon: MapPin,
    items: [
      { href: "/yonetim/etkinlikler", labelKey: "nav.events", icon: Calendar, descriptionKey: "nav.eventsDesc" },
      { href: "/yonetim/mekanlar", labelKey: "nav.venues", icon: MapPin, descriptionKey: "nav.venuesDesc" },
      { href: "/yonetim/salon-yapim-wizard", labelKey: "nav.salonWizard", icon: LayoutGrid, descriptionKey: "nav.salonWizardDesc" },
      { href: "/yonetim/salon-yapim-wizard-2", label: "Salon Wizard 2", icon: LayoutGrid, description: "Yeni salon kurulum sihirbazı (eski wizard’a dokunmaz)" },
      { href: "/yonetim/sehirler", labelKey: "nav.cities", icon: MapPin, descriptionKey: "nav.citiesDesc" },
      { href: "/yonetim/sanatcilar", labelKey: "nav.artists", icon: User, descriptionKey: "nav.artistsDesc" },
      { href: "/yonetim/bilet-turleri", labelKey: "nav.ticketTypes", icon: Ticket, descriptionKey: "nav.ticketTypesDesc" },
    ],
  },
  {
    key: "sales",
    label: "Satış & Kasa",
    icon: CreditCard,
    items: [
      { href: "/yonetim/bilet-listesi", labelKey: "nav.orders", icon: CreditCard, descriptionKey: "nav.ordersDesc" },
      { href: "/yonetim/gise", label: "Gişe kayıtları", icon: Ticket, description: "Kim, nerede, kaç bilet kesti" },
      { href: "/yonetim/gise-gorevlendirmeleri", label: "Gişe görevlendirmeleri", icon: Users, description: "Kapıda bilet satma yetkisi verme" },
      { href: "/yonetim/bilet-ozeti", labelKey: "nav.ticketSummary", icon: PieChart, descriptionKey: "nav.ticketSummaryDesc" },
      { href: "/yonetim/amed-spor-kayitlar", label: "Amed Spor Kayıtları", icon: Users, description: "Form kayıt listesi ve CSV" },
    ],
  },
  {
    key: "finance",
    label: "Finans",
    icon: Wallet,
    items: [
      { href: "/yonetim/muhasebe", labelKey: "nav.accounting", icon: BarChart3, descriptionKey: "nav.accountingDesc" },
      { href: "/yonetim/satis-raporu", label: "Satış & kazanç", icon: Wallet, description: "Ciro, komisyon ve organizatöre kalan (payout)" },
      { href: "/yonetim/faturalar", label: "Faturalar", icon: FileText, description: "Rechnung / KDV / ZUGFeRD XML" },
      { href: "/yonetim/etkinlik-raporlari", label: "Etkinlik raporları", icon: BarChart3, description: "Veranstaltungsabrechnung: PDF ve e-posta" },
    ],
  },
  {
    key: "people",
    label: "Kullanıcılar",
    icon: Users,
    items: [
      { href: "/yonetim/kullanicilar", labelKey: "nav.users", icon: Users, description: "Roller, e-posta/şifre düzeltme, şirket bilgileri ve müşteri arama" },
    ],
  },
  {
    key: "site",
    label: "Site & Görünüm",
    icon: Palette,
    items: [
      { href: "/yonetim/slider-yonetimi", labelKey: "nav.slider", icon: Megaphone, descriptionKey: "nav.sliderDesc" },
      { href: "/yonetim/hero-backgrounds", label: "Ana Slider Fotoğrafları", icon: ImageIcon, description: "Hero görseli ekle, sil, görünür/gizli yap" },
      { href: "/yonetim/logolar", label: "Logo ve Simgeler", icon: Palette, description: "Üst/alt logo ve favicon yükle" },
      { href: "/yonetim/ayarlar", labelKey: "nav.settings", icon: Settings, descriptionKey: "nav.settingsDesc" },
    ],
  },
  {
    key: "control",
    label: "Kontrol & Analiz",
    icon: Shield,
    items: [
      { href: "/yonetim/bilet-kontrol", labelKey: "nav.ticketCheck", icon: Shield, descriptionKey: "nav.ticketCheckDesc" },
      { href: "/yonetim/etkinlik-uyarilari", labelKey: "nav.eventAlerts", icon: Bell, descriptionKey: "nav.eventAlertsDesc" },
      { href: "/yonetim/huni-analitigi", labelKey: "nav.funnel", icon: BarChart3, descriptionKey: "nav.funnelDesc" },
      { href: "/yonetim/audit-log", labelKey: "nav.audit", icon: Shield, descriptionKey: "nav.auditDesc" },
    ],
  },
];

/** Panel ortasında gösterilen günlük kısayollar; kalan sayfalar sol menüde gruplu. */
export const ADMIN_QUICK_LINKS: Array<{ href: string; title: string; description: string }> = [
  { href: "/yonetim/etkinlikler", title: "Etkinlikler", description: "Tüm etkinlikleri yönetin" },
  { href: "/yonetim/bilet-listesi", title: "Siparişler / Biletler", description: "Satılan biletler ve siparişler" },
  { href: "/yonetim/faturalar", title: "Faturalar", description: "Rechnung / KDV / ZUGFeRD XML" },
  { href: "/yonetim/etkinlik-raporlari", title: "Etkinlik raporları", description: "Abrechnung: PDF ve e-posta" },
  { href: "/yonetim/kullanicilar", title: "Kullanıcılar", description: "Rol, yetki ve şirket bilgileri" },
  { href: "/yonetim/ayarlar", title: "Ayarlar", description: "Sistem ayarları" },
];

export function findAdminNavItem(href: string): AdminNavItem | undefined {
  for (const group of ADMIN_NAV_GROUPS) {
    const found = group.items.find((item) => item.href === href);
    if (found) return found;
  }
  return undefined;
}

/** Verilen yol hangi gruba aitse onun anahtarı; bulunamazsa undefined. */
export function findGroupKeyForPath(pathname: string): string | undefined {
  const normalized = (pathname || "").replace(/\/+$/, "");
  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href === normalized) return group.key;
    }
  }
  // Alt sayfalar (örn. /yonetim/etkinlikler/yeni) üst yolun grubuna düşer.
  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href !== "/yonetim" && normalized.startsWith(`${item.href}/`)) return group.key;
    }
  }
  return undefined;
}
