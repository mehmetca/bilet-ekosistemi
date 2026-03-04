import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { message: "Sunucu yapılandırması eksik." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: experiments } = await supabase
      .from("ab_experiments")
      .select("id")
      .eq("is_active", true)
      .limit(1);

    if (!experiments?.length) {
      return NextResponse.json({ variants: [] });
    }

    const { data: variants, error } = await supabase
      .from("ab_variants")
      .select("id, variant_key, hero_title, hero_subtitle, cta_text, weight")
      .eq("experiment_id", experiments[0].id)
      .order("variant_key");

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ variants: variants || [] });
  } catch (e) {
    console.error("AB variants fetch error:", e);
    return NextResponse.json(
      { message: "Varyantlar alınamadı." },
      { status: 500 }
    );
  }
}
