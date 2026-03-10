import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Ana sayfa ile AYNI sorgu: is_active + is_approved, created_at desc, limit 50.
 * Local vs production aynı listeyi döndürüyor mu karşılaştırmak için:
 *   curl http://localhost:3000/api/events/compare
 *   curl https://SITE.vercel.app/api/events/compare
 * İkisinde de count, ids ve show_slugs aynı olmalı (aynı Supabase + env ise).
 */
const COLUMNS =
  "id,title,slug,show_slug,date,created_at,is_approved";

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

    if (error) {
      return NextResponse.json(
        { error: error.message, count: 0, ids: [], show_slugs: [] },
        { status: 200 }
      );
    }

    const list = (data ?? []) as { id: string; show_slug?: string | null }[];
    const ids = list.map((e) => e.id);
    const show_slugs = list.map((e) => e.show_slug ?? "");

    return NextResponse.json({
      count: list.length,
      ids,
      show_slugs,
      hint: "Aynı veriyi görmek için local ve production'da .env'lerin aynı Supabase projesine işaret etmesi gerekir.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), count: 0, ids: [], show_slugs: [] },
      { status: 200 }
    );
  }
}
