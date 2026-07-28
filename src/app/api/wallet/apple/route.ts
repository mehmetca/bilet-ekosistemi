import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const ticketCode = searchParams.get("ticketCode") || "TICKET-123456";
    const eventTitle = searchParams.get("eventTitle") || "KurdEvents Etkinliği";
    const eventDate = searchParams.get("eventDate") || "";
    const eventTime = searchParams.get("eventTime") || "";
    const venue = searchParams.get("venue") || "";
    const seatInfo = searchParams.get("seatInfo") || "Genel Giriş";
    const buyerName = searchParams.get("buyerName") || "Misafir Kullanıcı";

    // Apple Pass JSON yapısı (PKPass Standardı)
    const passStructure = {
      formatVersion: 1,
      passTypeIdentifier: "pass.com.kurdevents.ticket",
      serialNumber: ticketCode,
      teamIdentifier: "KURDEVENTS",
      organizationName: "KurdEvents Bilet Ekosistemi",
      description: `${eventTitle} Giriş Bileti`,
      logoText: "KurdEvents",
      foregroundColor: "rgb(255, 255, 255)",
      backgroundColor: "rgb(15, 23, 42)",
      labelColor: "rgb(148, 163, 184)",
      eventTicket: {
        primaryFields: [
          {
            key: "event",
            label: "ETKİNLİK",
            value: eventTitle,
          },
        ],
        secondaryFields: [
          {
            key: "date",
            label: "TARİH & SAAT",
            value: `${eventDate} ${eventTime}`.trim() || "Belirtilmedi",
          },
          {
            key: "venue",
            label: "MEKAN",
            value: venue || "TBA",
          },
        ],
        auxiliaryFields: [
          {
            key: "seat",
            label: "KOLTUK / KATEGORİ",
            value: seatInfo,
          },
          {
            key: "passenger",
            label: "BİLET SAHİBİ",
            value: buyerName,
          },
        ],
        barcode: {
          format: "PKBarcodeFormatQR",
          message: ticketCode,
          messageEncoding: "iso-8859-1",
        },
        barcodes: [
          {
            format: "PKBarcodeFormatQR",
            message: ticketCode,
            messageEncoding: "iso-8859-1",
          },
        ],
      },
    };

    // pass.json dosyasını JSON string olarak oluştur
    const passJsonBuffer = Buffer.from(JSON.stringify(passStructure, null, 2), "utf-8");

    // NOT: Üretim ortamında Apple Developer sertifikası ile imzalı .pkpass Zip üretilir.
    // Şimdilik standart pkpass JSON payload'ını indirilebilir buffer olarak sunuyoruz.
    return new NextResponse(passJsonBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="ticket-${ticketCode}.pkpass"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Apple Pass üretilemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
