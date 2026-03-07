import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const artistId = body.artist_id as string;
    const action = (body.action as "follow" | "unfollow") || "follow";
    const sessionId = (body.session_id as string)?.trim() || null;

    if (!artistId) {
      return NextResponse.json(
        { success: false, message: "artist_id gerekli." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { success: false, message: "Veritabanı yapılandırması eksik." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    let userId: string | null = null;
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    }

    if (action === "unfollow") {
      const q = supabase.from("artist_follows").delete().eq("artist_id", artistId);
      if (userId) q.eq("user_id", userId);
      else if (sessionId) q.eq("session_id", sessionId);
      else {
        return NextResponse.json(
          { success: false, message: "Oturum veya session_id gerekli." },
          { status: 400 }
        );
      }
      const { error } = await q;
      if (error) {
        console.error("artist_follows delete error:", error);
        return NextResponse.json({ success: false, message: "İşlem başarısız." }, { status: 500 });
      }
      return NextResponse.json({ success: true, following: false });
    }

    if (!userId && !sessionId) {
      return NextResponse.json(
        { success: false, message: "Oturum veya session_id gerekli." },
        { status: 400 }
      );
    }

    const row: { artist_id: string; user_id?: string; session_id?: string } = {
      artist_id: artistId,
    };
    if (userId) row.user_id = userId;
    if (sessionId) row.session_id = sessionId;

    const { error } = await supabase.from("artist_follows").insert(row);
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ success: true, following: true });
      }
      console.error("artist_follows insert error:", error);
      return NextResponse.json({ success: false, message: "İşlem başarısız." }, { status: 500 });
    }
    return NextResponse.json({ success: true, following: true });
  } catch (error) {
    console.error("artist-follow API error:", error);
    return NextResponse.json({ success: false, message: "Bir hata oluştu." }, { status: 500 });
  }
}
