import { revalidatePath, revalidateTag } from "next/cache";
import { routing } from "@/i18n/routing";

/** Ana sayfa, arama, takvim, etkinlik detay ve site haritası önbelleğini temizler. */
export function revalidatePublicEventCaches(): void {
  revalidateTag("home");
  revalidateTag("events");
  revalidateTag("tickets");
  revalidateTag("events-calendar");
  revalidateTag("sitemap");
  revalidateTag("artists");
  revalidateTag("venues");
  revalidateTag("cities");
  revalidateTag("advertisements");

  for (const locale of routing.locales) {
    revalidatePath(`/${locale}`, "layout");
    revalidatePath(`/${locale}`, "page");
    revalidatePath(`/${locale}/arama`, "page");
    revalidatePath(`/${locale}/takvim`, "page");
    revalidatePath(`/${locale}/sehirler`, "page");
    revalidatePath(`/${locale}/sanatci`, "page");
    revalidatePath(`/${locale}/sanatci`, "layout");
    /* Dinamik detay sayfaları: fiyat/bilet değişikliği tüm dillerde anında yansısın. */
    revalidatePath(`/${locale}/etkinlik/[id]`, "page");
    revalidatePath(`/${locale}/sanatci/[slug]`, "page");
    revalidatePath(`/${locale}/city/[slug]`, "page");
    revalidatePath(`/${locale}/mekanlar/[id]`, "page");
  }
}

export function revalidateAdvertisementCaches(): void {
  revalidateTag("advertisements");
  revalidateTag("home");
}

export function revalidateSiteSettingsCache(): void {
  revalidateTag("site-settings");
}
