/**
 * Kanonik site kökü (SEO: canonical, sitemap, Open Graph).
 * Üretimde `NEXT_PUBLIC_SITE_URL=https://eventseat.de` ayarlayın.
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  return "http://localhost:3000";
}
