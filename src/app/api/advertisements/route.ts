import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

const ADVERTISEMENT_FIELDS = [
  "title",
  "image_url",
  "link_url",
  "placement",
  "is_active",
  "locale",
  "overlay_title",
  "overlay_day",
  "overlay_month_year",
] as const;

function pickAdvertisementPayload(body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const field of ADVERTISEMENT_FIELDS) {
    if (field in body) payload[field] = body[field];
  }
  return payload;
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
      // tr disindaki dillerde TR kayitlari da fallback olarak gosterilsin.
      if (locale === "tr") {
        query = query.or("locale.eq.tr,locale.is.null");
      } else {
        query = query.or(`locale.eq.${locale},locale.eq.tr,locale.is.null`);
      }
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
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = pickAdvertisementPayload(body);
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("advertisements")
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) {
      // DB migration uygulanmadiysa yeni overlay alanlarini cikartip tekrar dene.
      const msg = String(error.message || "");
      const overlaySchemaMissing =
        msg.includes("overlay_title") || msg.includes("overlay_day") || msg.includes("overlay_month_year");
      if (overlaySchemaMissing) {
        const safeBody = { ...payload } as Record<string, unknown>;
        delete safeBody.overlay_title;
        delete safeBody.overlay_day;
        delete safeBody.overlay_month_year;

        const retry = await supabaseAdmin
          .from("advertisements")
          .insert(safeBody)
          .select()
          .maybeSingle();

        if (!retry.error) {
          return NextResponse.json(retry.data, { status: 201 });
        }
      }
      return NextResponse.json({ error: "Reklam eklenemedi" }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Sunucu hatasi" }, { status: 500 });
  }
}
