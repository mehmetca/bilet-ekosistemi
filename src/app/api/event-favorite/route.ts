import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventId = body.event_id as string;
    const action = (body.action as "add" | "remove") || "add";
    const sessionId = (body.session_id as string)?.trim() || null;

    if (!eventId) {
      return NextResponse.json(
        { success: false, message: "event_id gerekli." },
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

    if (action === "remove") {
      const q = supabase.from("event_favorites").delete().eq("event_id", eventId);
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
        console.error("event_favorites delete error:", error);
        return NextResponse.json({ success: false, message: "İşlem başarısız." }, { status: 500 });
      }
      return NextResponse.json({ success: true, favorite: false });
    }

    if (!userId && !sessionId) {
      return NextResponse.json(
        { success: false, message: "Oturum veya session_id gerekli." },
        { status: 400 }
      );
    }

    const row: { event_id: string; user_id?: string; session_id?: string } = {
      event_id: eventId,
    };
    if (userId) row.user_id = userId;
    if (sessionId) row.session_id = sessionId;

    const { error } = await supabase.from("event_favorites").insert(row);
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ success: true, favorite: true });
      }
      console.error("event_favorites insert error:", error);
      return NextResponse.json({ success: false, message: "İşlem başarısız." }, { status: 500 });
    }
    return NextResponse.json({ success: true, favorite: true });
  } catch (error) {
    console.error("event-favorite API error:", error);
    return NextResponse.json({ success: false, message: "Bir hata oluştu." }, { status: 500 });
  }
}
