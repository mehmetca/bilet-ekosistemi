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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  try {
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const payload = pickAdvertisementPayload(body);
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("advertisements")
      .update(payload)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      // DB migration uygulanmadiysa overlay alanlarini cikartip tekrar dene.
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
          .update(safeBody)
          .eq("id", id)
          .select()
          .maybeSingle();

        if (!retry.error && retry.data) {
          return NextResponse.json(retry.data);
        }
      }

      return NextResponse.json(
        { error: `Reklam guncellenemedi: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Reklam guncellenemedi: guncelleme sonucu bos dondu" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Sunucu hatasi" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  try {
    const { id } = await params;
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from("advertisements")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Reklam silinemedi" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Sunucu hatasi" }, { status: 500 });
  }
}
