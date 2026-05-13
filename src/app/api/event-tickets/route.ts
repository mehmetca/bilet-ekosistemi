import { NextRequest, NextResponse } from "next/server";
import { getEventTickets } from "@/lib/events-server";

/**
 * GET ?event_id=… — etkinlik bilet satırları (stok dahil). Satış sayfasında canlı yenileme için.
 */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("event_id")?.trim();
  if (!eventId) {
    return NextResponse.json({ tickets: [] }, { status: 400 });
  }
  try {
    const tickets = await getEventTickets(eventId);
    const res = NextResponse.json({ tickets });
    res.headers.set("Cache-Control", "no-store, max-age=0");
    return res;
  } catch {
    return NextResponse.json({ tickets: [] }, { status: 500 });
  }
}
