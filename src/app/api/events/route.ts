import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { handleApiError } from "@/lib/error-handler";

export const revalidate = 60;

const COLUMNS =
  "id,title,slug,date,time,venue,location,image_url,category,price_from,currency,created_at,is_active,is_approved,is_draft,homepage_featured_order,title_tr,title_de,title_en,title_ku,title_ckb,venue_tr,venue_de,venue_en,show_slug";

function todayIsoDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("events")
      .select(COLUMNS)
      .eq("is_active", true)
      .eq("is_approved", true)
      .eq("is_draft", false)
      .gte("date", todayIsoDate())
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .limit(72);
    if (error) {
      const errorResponse = handleApiError(error, "Events API");
      return NextResponse.json(
        { error: errorResponse.error },
        { status: errorResponse.statusCode }
      );
    }
    return NextResponse.json(data ?? [], {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
        "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (e) {
    const errorResponse = handleApiError(e, "Events API exception");
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
