import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

const SETTINGS_KEY = "salon_yapim_wizard_plan";

/** Planı oku (herkese açık – önizleme için). Yönetim paneli kendi auth ile istek atar. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (error || !data?.value) {
      return NextResponse.json({ plan2Blocks: null, savedAt: null });
    }

    const value = data.value as { plan2Blocks?: unknown[]; savedAt?: string } | null;
    const plan2Blocks = Array.isArray(value?.plan2Blocks) ? value.plan2Blocks : null;
    const savedAt = typeof value?.savedAt === "string" ? value.savedAt : null;

    return NextResponse.json({ plan2Blocks, savedAt });
  } catch (e) {
    console.error("salon-yapim-plan GET error:", e);
    return NextResponse.json({ plan2Blocks: null, savedAt: null }, { status: 200 });
  }
}

/** Planı kaydet (sadece admin). Canlıda da aynı plan yüklensin diye sunucuya yazar. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const plan2Blocks = Array.isArray(body.plan2Blocks) ? body.plan2Blocks : null;
    const savedAt = new Date().toISOString();

    if (!plan2Blocks || plan2Blocks.length === 0) {
      return NextResponse.json({ error: "plan2Blocks dizi olmalı" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error: upsertError } = await supabase
      .from("site_settings")
      .upsert(
        { key: SETTINGS_KEY, value: { plan2Blocks, savedAt } },
        { onConflict: "key" }
      );

    if (upsertError) {
      console.error("salon-yapim-plan POST upsert error:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, savedAt });
  } catch (e) {
    console.error("salon-yapim-plan POST error:", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
