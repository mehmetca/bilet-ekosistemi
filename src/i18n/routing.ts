import { defineRouting } from "next-intl/routing";
import { i18n } from "./config";

export const routing = defineRouting({
  locales: i18n.locales,
  defaultLocale: i18n.defaultLocale,
  localePrefix: "always",
  // URL'deki locale korunsun; tarayıcı dili/çerez ile otomatik yönlendirme yapılmasın
  localeDetection: i18n.localeDetection,
});
