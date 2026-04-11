import { routing } from "@/i18n/routing";

/**
 * next-intl usePathname bazen /de/de/... sonrası yalnızca bir /de soyar;
 * router.replace ile tekrar locale eklenince /de/de/... oluşur. Tüm önekleri soy.
 */
export function stripLocalePrefixes(pathname: string): string {
  let p = pathname || "/";
  let prev = "";
  while (p !== prev) {
    prev = p;
    for (const loc of routing.locales) {
      const prefix = `/${loc}`;
      if (p === prefix) {
        p = "/";
        break;
      }
      if (p.startsWith(`${prefix}/`)) {
        p = p.slice(prefix.length) || "/";
        break;
      }
    }
  }
  if (!p.startsWith("/")) p = `/${p}`;
  return p || "/";
}
