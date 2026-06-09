import { revalidateTag } from "next/cache";

/** Ana sayfa, etkinlik detay ve site haritası önbelleğini temizler. */
export function revalidatePublicEventCaches(): void {
  revalidateTag("home");
  revalidateTag("events");
  revalidateTag("sitemap");
}
