import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

const COLUMNS =
  "id,title,slug,date,time,venue,location,image_url,category,price_from,currency,created_at,is_active,is_approved,title_tr,title_de,title_en,venue_tr,venue_de,venue_en,show_slug";

export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("events")
      .select(COLUMNS)
      .eq("is_active", true)
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return NextResponse.json([], { status: 200 });
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
