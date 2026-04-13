import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

type Locale = (typeof routing.locales)[number];
type MessageValue = string | number | boolean | null | MessageTree;
type MessageTree = { [key: string]: MessageValue };

function isObject(value: MessageValue | undefined): value is MessageTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeMessages(base: MessageTree, override: MessageTree): MessageTree {
  const merged: MessageTree = { ...base };

  for (const key of Object.keys(override)) {
    const baseValue = merged[key];
    const overrideValue = override[key];

    if (isObject(baseValue) && isObject(overrideValue)) {
      merged[key] = mergeMessages(baseValue, overrideValue);
    } else {
      merged[key] = overrideValue;
    }
  }

  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as Locale)) {
    locale = routing.defaultLocale;
  }

  const trMessages = (await import(`../../messages/tr.json`)).default as MessageTree;
  const localeMessages = (
    await import(`../../messages/${locale}.json`)
  ).default as MessageTree;

  return {
    locale,
    messages: locale === "tr" ? trMessages : mergeMessages(trMessages, localeMessages),
  };
});
