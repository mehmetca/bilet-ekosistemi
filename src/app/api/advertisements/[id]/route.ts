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

    const { data, error } = await supabaseAdmin
      .from("advertisements")
      .update(body)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Reklam guncellenemedi" }, { status: 500 });
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
