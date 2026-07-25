import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

/** Eski wizard anahtarı (`salon_yapim_wizard_plan`) ile karışmaz. */
const SETTINGS_KEY = "salon_yapim_wizard_2_plan";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (error || !data?.value) {
      return NextResponse.json({ draft: null, savedAt: null });
    }

    const value = data.value as { draft?: unknown; savedAt?: string } | null;
    const draft = value?.draft && typeof value.draft === "object" ? value.draft : null;
    const savedAt = typeof value?.savedAt === "string" ? value.savedAt : null;

    return NextResponse.json({ draft, savedAt });
  } catch (e) {
    console.error("salon-yapim-wizard-2 plan GET error:", e);
    return NextResponse.json({ draft: null, savedAt: null }, { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const draft = body.draft && typeof body.draft === "object" ? body.draft : null;
    if (!draft) {
      return NextResponse.json({ error: "draft gerekli" }, { status: 400 });
    }

    const savedAt = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const { error: upsertError } = await supabase.from("site_settings").upsert(
      { key: SETTINGS_KEY, value: { draft, savedAt } },
      { onConflict: "key" }
    );

    if (upsertError) {
      console.error("salon-yapim-wizard-2 plan POST error:", upsertError);
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, savedAt });
  } catch (e) {
    console.error("salon-yapim-wizard-2 plan POST error:", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

/** Taslağı sil — Wizard 2’yi geri almak için. Eski wizard’a dokunmaz. */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("site_settings").delete().eq("key", SETTINGS_KEY);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("salon-yapim-wizard-2 plan DELETE error:", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
