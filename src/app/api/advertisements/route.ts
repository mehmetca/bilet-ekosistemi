import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get("locale");

    let query = supabaseAdmin
      .from("advertisements")
      .select("*")
      .order("created_at", { ascending: false });

    if (locale && ["tr", "de", "en"].includes(locale)) {
      query = query.or(`locale.eq.${locale},locale.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Reklamlar yuklenemedi" }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json({ error: "Sunucu hatasi" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("advertisements")
      .insert(body)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "Reklam eklenemedi" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Sunucu hatasi" }, { status: 500 });
  }
}
