import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { revalidateAdvertisementCaches } from "@/lib/revalidate-public-cache";
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
    if (!(field in body)) continue;
    const value = body[field];
    // Boş string overlay alanlarını null yap (DB/UI tutarlılığı)
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

async function updateAdvertisement(
  id: string,
  payload: Record<string, unknown>
) {
  const supabaseAdmin = getSupabaseAdmin();

  // Önce satır var mı kontrol et — boş RETURNING'i "başarısız güncelleme" sanmayalım.
  const existing = await supabaseAdmin
    .from("advertisements")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existing.error) {
    return { error: `Reklam bulunamadı: ${existing.error.message}`, status: 500 as const };
  }
  if (!existing.data) {
    return { error: "Reklam bulunamadı. Listeyi yenileyip tekrar deneyin.", status: 404 as const };
  }

  const { error } = await supabaseAdmin.from("advertisements").update(payload).eq("id", id);

  if (error) {
    const msg = String(error.message || "");
    const overlaySchemaMissing =
      msg.includes("overlay_title") || msg.includes("overlay_day") || msg.includes("overlay_month_year");
    if (overlaySchemaMissing) {
      const safeBody = { ...payload };
      delete safeBody.overlay_title;
      delete safeBody.overlay_day;
      delete safeBody.overlay_month_year;

      const retry = await supabaseAdmin.from("advertisements").update(safeBody).eq("id", id);
      if (retry.error) {
        return { error: `Reklam guncellenemedi: ${retry.error.message}`, status: 500 as const };
      }
    } else {
      return { error: `Reklam guncellenemedi: ${error.message}`, status: 500 as const };
    }
  }

  const updated = await supabaseAdmin.from("advertisements").select("*").eq("id", id).maybeSingle();
  if (updated.error) {
    return { error: `Reklam guncellenemedi: ${updated.error.message}`, status: 500 as const };
  }
  if (!updated.data) {
    return {
      error: "Reklam guncellenemedi: kayit bulunamadi (guncelleme sonucu bos).",
      status: 500 as const,
    };
  }

  return { data: updated.data };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  try {
    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Reklam id gerekli" }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payload = pickAdvertisementPayload(body);
    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: "Guncellenecek alan yok" }, { status: 400 });
    }

    const result = await updateAdvertisement(id.trim(), payload);
    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    revalidateAdvertisementCaches();
    return NextResponse.json(result.data);
  } catch (err) {
    console.error("PUT /api/advertisements/[id] error:", err);
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

    const { data: existing, error: findError } = await supabaseAdmin
      .from("advertisements")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: "Reklam silinemedi" }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Reklam bulunamadı" }, { status: 404 });
    }

    const { error } = await supabaseAdmin.from("advertisements").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Reklam silinemedi" }, { status: 500 });
    }

    revalidateAdvertisementCaches();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Sunucu hatasi" }, { status: 500 });
  }
}
