import { revalidatePath, revalidateTag } from "next/cache";
import { routing } from "@/i18n/routing";

/** Ana sayfa, arama, takvim, etkinlik detay ve site haritası önbelleğini temizler. */
export function revalidatePublicEventCaches(): void {
  revalidateTag("home");
  revalidateTag("events");
  revalidateTag("events-calendar");
  revalidateTag("sitemap");

  for (const locale of routing.locales) {
    revalidatePath(`/${locale}`, "layout");
    revalidatePath(`/${locale}`, "page");
    revalidatePath(`/${locale}/arama`, "page");
    revalidatePath(`/${locale}/takvim`, "page");
  }
}
