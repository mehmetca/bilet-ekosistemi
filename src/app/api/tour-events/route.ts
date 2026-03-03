import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Environment variable'ları kontrol et
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing Supabase environment variables");
  throw new Error("Supabase configuration error");
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { data, error } = await supabaseAdmin
      .from("tour_events")
      .insert({
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error("Tour event creation error:", error);
      return NextResponse.json({ error: "Etkinlik eklenemedi" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from("tour_events")
      .select(`
        *,
        artists!inner (
          name,
          slug,
          image_url
        )
      `)
      .order("event_date", { ascending: false });

    if (error) {
      console.error("Tour events fetch error:", error);
      return NextResponse.json({ error: "Etkinlikler alınamadı" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
