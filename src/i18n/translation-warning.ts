import trMessages from "../../messages/tr.json";
import deMessages from "../../messages/de.json";
import enMessages from "../../messages/en.json";
import kuMessages from "../../messages/ku.json";
import ckbMessages from "../../messages/ckb.json";

type SupportedLocale = "tr" | "de" | "en" | "ku" | "ckb";

const warningByLocale: Record<SupportedLocale, string> = {
  tr: trMessages.errors.translationWarning,
  de: deMessages.errors.translationWarning,
  en: enMessages.errors.translationWarning,
  ku: kuMessages.errors.translationWarning,
  ckb: ckbMessages.errors.translationWarning,
};

export function getTranslationWarning(locale?: string): string {
  if (locale && locale in warningByLocale) {
    return warningByLocale[locale as SupportedLocale];
  }
  return warningByLocale.tr;
}
