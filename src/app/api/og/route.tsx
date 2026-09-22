import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getSiteUrl } from "@/lib/site-url";
import { loadMessagesWithEnFallback } from "@/i18n/load-messages";

export const runtime = "nodejs";

/** Marka logosu (300×90 oranında). */
const BRAND_LOGO = "/images/kurdevent-logo.png";
/** Çeviri bulunamazsa kullanılacak varsayılan slogan. */
const FALLBACK_SLOGAN = "Tüm etkinlikler için bilet platformu";

/** Slogan, sitedeki `home.seoH1` çevirisinden okunur; böylece her dilde kendi metni görünür. */
async function readSlogan(locale: string): Promise<string> {
  try {
    const messages = await loadMessagesWithEnFallback(locale);
    const home = messages["home"];
    if (home && typeof home === "object" && !Array.isArray(home)) {
      const value = (home as Record<string, unknown>)["seoH1"];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } catch {
    /* çeviri yüklenemezse varsayılan slogana düş */
  }
  return FALLBACK_SLOGAN;
}

/**
 * Sosyal paylaşım kartı: beyaz zemin üzerinde logo + dile göre slogan.
 * Diğer URL parametreleri (title/date/venue/image) artık kullanılmaz.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const locale = searchParams.get("locale") || "tr";

    const logoSrc = `${getSiteUrl()}${BRAND_LOGO}`;
    const slogan = await readSlogan(locale);

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "44px",
            padding: "80px",
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            fontFamily: "sans-serif",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            alt="KurdEvents"
            style={{ width: "520px", height: "156px", objectFit: "contain" }}
          />
          <div
            style={{
              fontSize: "40px",
              fontWeight: 600,
              color: "#0f172a",
              textAlign: "center",
              lineHeight: 1.3,
            }}
          >
            {slogan}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "OG Image generation error";
    return new Response(`OG Görsel Üretim Hatası: ${message}`, { status: 500 });
  }
}
