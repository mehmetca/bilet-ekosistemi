/**
 * OAuth PKCE ve oturum çerezlerinin aynı kök alan adındaki host'lar arasında
 * (örn. eventseat.de ↔ www.eventseat.de) paylaşılması için `Set-Cookie` domain.
 * localhost ve *.vercel.app için dönüş yok (yanlışlıkla geniş alan adına yazmayı önler).
 */
export function authCookieDomainFromHost(hostOrHostname: string | undefined | null): string | undefined {
  if (!hostOrHostname) return undefined;
  const hostname = hostOrHostname.split(":")[0]?.toLowerCase();
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") return undefined;
  if (hostname.endsWith(".vercel.app")) return undefined;
  const parts = hostname.split(".").filter(Boolean);
  if (parts.length < 2) return undefined;
  const root = parts.slice(-2).join(".");
  return `.${root}`;
}
