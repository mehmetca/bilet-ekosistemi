import { fallbackLocale } from "./config";

export type MessageValue = string | number | boolean | null | MessageTree;
export type MessageTree = { [key: string]: MessageValue };

function isObject(value: MessageValue | undefined): value is MessageTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Derin birleştirme: `override` dolu olan dalları kazanır. */
export function mergeMessages(base: MessageTree, override: MessageTree): MessageTree {
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

/**
 * Tüm diller için: önce `en.json` (fallbackLocale), üzerine seçilen locale.
 * `en` için yalnızca `en.json` döner.
 */
export async function loadMessagesWithEnFallback(locale: string): Promise<MessageTree> {
  const enMessages = (await import(`../../messages/${fallbackLocale}.json`)).default as MessageTree;

  if (locale === fallbackLocale) {
    return enMessages;
  }

  const localeMessages = (await import(`../../messages/${locale}.json`)).default as MessageTree;
  return mergeMessages(enMessages, localeMessages);
}
