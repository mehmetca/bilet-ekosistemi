import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

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
      console.error("Events API error:", error);
      return NextResponse.json(
        { error: "Etkinlikler yüklenirken bir hata oluştu." },
        { status: 500 }
      );
    }
    return NextResponse.json(data ?? []);
  } catch (e) {
    console.error("Events API exception:", e);
    return NextResponse.json(
      { error: "Etkinlikler yüklenirken bir hata oluştu." },
      { status: 500 }
    );
  }
}
