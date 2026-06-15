import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    const body = (await request.json()) as { password?: string; passwordConfirm?: string };
    const { password, passwordConfirm } = body;
    if (!password || !passwordConfirm) {
      return NextResponse.json({ error: "Yeni şifre ve tekrarı gerekli" }, { status: 400 });
    }
    if (password !== passwordConfirm) {
      return NextResponse.json({ error: "Şifreler eşleşmiyor" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Şifre en az 6 karakter olmalı" }, { status: 400 });
    }
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("password update error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
