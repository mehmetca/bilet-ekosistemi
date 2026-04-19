import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { loadMessagesWithEnFallback } from "./load-messages";

type Locale = (typeof routing.locales)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }

  const messages = await loadMessagesWithEnFallback(locale);

  return {
    locale,
    messages,
  };
});
