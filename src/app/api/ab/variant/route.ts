import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServerSupabase();

    const { data: experiments, error: expErr } = await supabase
      .from("ab_experiments")
      .select("id, name")
      .eq("is_active", true)
      .limit(1);

    if (expErr || !experiments?.length) {
      return NextResponse.json({
        variant: null,
        hero_title: "Hayalinizdaki Etkinliğe Bilet Bulun",
        hero_subtitle:
          "Konser, tiyatro, stand-up ve daha fazlası. Güvenli ödeme ile kolayca bilet alın.",
        cta_text: "Ara",
      });
    }

    const exp = experiments[0];
    const { data: variants, error: varErr } = await supabase
      .from("ab_variants")
      .select("id, variant_key, hero_title, hero_subtitle, cta_text, weight")
      .eq("experiment_id", exp.id)
      .order("variant_key");

    if (varErr || !variants?.length) {
      return NextResponse.json({
        variant: "A",
        hero_title: "Hayalinizdaki Etkinliğe Bilet Bulun",
        hero_subtitle:
          "Konser, tiyatro, stand-up ve daha fazlası. Güvenli ödeme ile kolayca bilet alın.",
        cta_text: "Ara",
      });
    }

    const totalWeight = variants.reduce((s, v) => s + (v.weight || 50), 0);
    let r = Math.random() * totalWeight;
    let chosen = variants[0];
    for (const v of variants) {
      r -= v.weight || 50;
      if (r <= 0) {
        chosen = v;
        break;
      }
    }

    return NextResponse.json({
      variant: chosen.variant_key,
      variant_id: chosen.id,
      hero_title: chosen.hero_title || "Hayalinizdaki Etkinliğe Bilet Bulun",
      hero_subtitle:
        chosen.hero_subtitle ||
        "Konser, tiyatro, stand-up ve daha fazlası. Güvenli ödeme ile kolayca bilet alın.",
      cta_text: chosen.cta_text || "Ara",
    });
  } catch (e) {
    console.error("AB variant fetch error:", e);
    return NextResponse.json({
      variant: "A",
      hero_title: "Hayalinizdaki Etkinliğe Bilet Bulun",
      hero_subtitle:
        "Konser, tiyatro, stand-up ve daha fazlası. Güvenli ödeme ile kolayca bilet alın.",
      cta_text: "Ara",
    });
  }
}
