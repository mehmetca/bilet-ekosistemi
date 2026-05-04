import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

const NEWS_FIELDS = [
  "title",
  "content",
  "summary",
  "excerpt",
  "image_url",
  "is_published",
  "title_tr",
  "title_de",
  "title_en",
  "content_tr",
  "content_de",
  "content_en",
  "excerpt_tr",
  "excerpt_de",
  "excerpt_en",
] as const;

function pickNewsPayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const field of NEWS_FIELDS) {
    if (field in body) payload[field] = body[field];
  }
  return payload;
}

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
    const body = (await request.json()) as Record<string, unknown>;
    const payload = pickNewsPayload(body);
    
    const { data, error } = await supabase
      .from("news")
      .insert({
        ...payload,
        is_published: payload.is_published === false ? false : true,
        published_at: payload.is_published === false ? null : new Date().toISOString(),
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
