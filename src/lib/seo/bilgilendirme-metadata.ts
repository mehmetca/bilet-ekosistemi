import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/lib/i18n-content";
import { loadMessagesWithEnFallback, type MessageTree } from "@/i18n/load-messages";
import { buildLocalePathMetadata } from "./locale-path-metadata";

function readNsString(messages: MessageTree, namespace: string, key: string): string {
  const branch = messages[namespace];
  if (!branch || typeof branch !== "object" || branch === null || Array.isArray(branch)) return "";
  const v = (branch as MessageTree)[key];
  return typeof v === "string" ? v : "";
}

/**
 * Bilgilendirme alt sayfaları: çeviri namespace'inde `title` + `intro` ile SEO metadata.
 * `getTranslations` kullanılmaz; üstte client layout olsa bile istek bağlamına ihtiyaç duymaz.
 */
export async function buildBilgilendirmePageMetadata(
  locale: string,
  pathSuffix: string,
  namespace: string
): Promise<Metadata> {
  const loc = (routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale) as string;
  const messages = await loadMessagesWithEnFallback(loc);
  let title = readNsString(messages, namespace, "title").trim();
  let intro = readNsString(messages, namespace, "intro").trim();
  if (!title || !intro) {
    const en = await loadMessagesWithEnFallback("en");
    if (!title) title = readNsString(en, namespace, "title").trim();
    if (!intro) intro = readNsString(en, namespace, "intro").trim();
  }
  if (!title) title = "KurdEvents";
  const description = intro.replace(/<[^>]*>/g, "").slice(0, 160).trim() || title;
  return buildLocalePathMetadata(loc, pathSuffix, { title: `${title} | KurdEvents`, description });
}
