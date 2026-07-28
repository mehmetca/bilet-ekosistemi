import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Parametreleri al
    const title = searchParams.get("title") || "KurdEvents | Bilet Ekosistemi";
    const date = searchParams.get("date") || "";
    const venue = searchParams.get("venue") || "";
    const category = searchParams.get("category") || "Etkinlik & Konser";
    const image = searchParams.get("image");

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            justifyContent: "space-between",
            backgroundColor: "#0f172a",
            backgroundImage:
              "radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.05) 2%, transparent 0%), radial-gradient(circle at 75px 75px, rgba(255, 255, 255, 0.05) 2%, transparent 0%)",
            backgroundSize: "100px 100px",
            color: "#ffffff",
            fontFamily: "sans-serif",
            padding: "48px",
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {/* Sol Kolon: Etkinlik Bilgileri */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: image ? "60%" : "100%",
              paddingRight: image ? "32px" : "0px",
              zIndex: 10,
            }}
          >
            {/* Üst Kısım: Logo ve Kategori Badge */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#e11d48",
                  color: "#ffffff",
                  padding: "8px 18px",
                  borderRadius: "9999px",
                  fontWeight: "bold",
                  fontSize: "18px",
                  letterSpacing: "0.5px",
                  boxShadow: "0 4px 14px rgba(225, 29, 72, 0.4)",
                }}
              >
                KurdEvents
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  color: "#cbd5e1",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontSize: "16px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                {category}
              </div>
            </div>

            {/* Orta Kısım: Etkinlik Başlığı */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", margin: "24px 0" }}>
              <div
                style={{
                  fontSize: title.length > 40 ? "40px" : "52px",
                  fontWeight: 800,
                  lineHeight: 1.15,
                  color: "#ffffff",
                  letterSpacing: "-0.5px",
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {title}
              </div>

              {/* Tarih ve Mekan Bilgileri */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
                {date && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#f43f5e", fontSize: "22px", fontWeight: 600 }}>
                    <span>📅</span>
                    <span>{date}</span>
                  </div>
                )}
                {venue && (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#94a3b8", fontSize: "20px" }}>
                    <span>📍</span>
                    <span>{venue}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Alt Kısım: Call to Action Bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "20px",
                borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <span style={{ fontSize: "18px", color: "#94a3b8", fontWeight: 500 }}>
                Hemen biletinizi güvenle alın
              </span>
              <div
                style={{
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  fontWeight: "bold",
                  fontSize: "16px",
                }}
              >
                Bilet Satın Al →
              </div>
            </div>
          </div>

          {/* Sağ Kolon: Etkinlik Görseli / Afişi (Eğer Varsa) */}
          {image && (
            <div
              style={{
                width: "40%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                borderRadius: "20px",
                overflow: "hidden",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
                border: "2px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt={title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          )}
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
