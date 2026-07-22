import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveAdvertisements } from "@/lib/advertisements-server";
import { revalidateAdvertisementCaches } from "@/lib/revalidate-public-cache";
import { requireAdmin } from "@/lib/api-auth";

export const revalidate = 1800;

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
    if (!(field in body)) continue;
    const value = body[field];
    if (
      (field === "overlay_title" || field === "overlay_day" || field === "overlay_month_year" || field === "link_url") &&
      typeof value === "string" &&
      value.trim() === ""
    ) {
      payload[field] = null;
      continue;
    }
    payload[field] = value;
  }
  // Tek slider tipi: her zaman ana slider
  payload.placement = "main_slider";
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get("locale") || undefined;

    // Admin paneli: Authorization varsa tum kayitlari (pasif dahil) dondur.
    const authHeader = request.headers.get("authorization");
    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      const auth = await requireAdmin(request);
      if (!(auth instanceof Response)) {
        const supabaseAdmin = getSupabaseAdmin();
        const { data, error } = await supabaseAdmin
          .from("advertisements")
          .select(
            "id,title,image_url,link_url,placement,is_active,locale,overlay_title,overlay_day,overlay_month_year,created_at"
          )
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Admin advertisements list error:", error.message);
          return NextResponse.json({ error: "Slider öğeleri yüklenemedi" }, { status: 500 });
        }
        return NextResponse.json(data || [], {
          headers: { "Cache-Control": "no-store" },
        });
      }
    }

    const data = await getActiveAdvertisements(locale || undefined);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
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
          revalidateAdvertisementCaches();
          return NextResponse.json(retry.data, { status: 201 });
        }
      }
      return NextResponse.json({ error: "Reklam eklenemedi" }, { status: 500 });
    }

    revalidateAdvertisementCaches();
    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Sunucu hatasi" }, { status: 500 });
  }
}
