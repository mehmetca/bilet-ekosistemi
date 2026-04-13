import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["tr", "de", "en", "ku", "ckb"],
  defaultLocale: "tr",
  localePrefix: "always",
  // URL'deki locale korunsun; tarayıcı dili/çerez ile otomatik yönlendirme yapılmasın
  localeDetection: false,
});
