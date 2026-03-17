import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  try {
    const { id } = await params;
    const body = await request.json();
    const supabaseAdmin = getSupabaseAdmin();

    const updateData = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    // Yayın durumu değişiyorsa published_at'i güncelle
    if ("is_published" in body) {
      updateData.published_at = body.is_published ? new Date().toISOString() : null;
    }

    const { data, error } = await supabaseAdmin
      .from("news")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("News update error:", error);
      return NextResponse.json({ error: "Haber güncellenemedi" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabaseAdmin = getSupabaseAdmin();

    const { error } = await supabaseAdmin
      .from("news")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("News delete error:", error);
      return NextResponse.json({ error: "Haber silinemedi" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
