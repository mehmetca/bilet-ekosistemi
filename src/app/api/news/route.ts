import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const published = searchParams.get("published");
    
    let query = supabase
      .from("news")
      .select("*")
      .order("created_at", { ascending: false });

    if (published === "true") {
      query = query.eq("is_published", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("News fetch error:", error);
      return NextResponse.json({ error: "Haberler yüklenemedi" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    
    const { data, error } = await supabase
      .from("news")
      .insert({
        ...body,
        is_published: true, // Otomatik yayınla
        published_at: new Date().toISOString(), // Her zaman yayın tarihi ekle
      })
      .select()
      .single();

    if (error) {
      console.error("News create error:", error);
      return NextResponse.json({ error: "Haber oluşturulamadı" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
