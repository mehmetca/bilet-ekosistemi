import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email as string)?.trim().toLowerCase();
    const eventId = body.event_id as string;

    if (!email || !eventId) {
      return NextResponse.json(
        { success: false, message: "E-posta ve etkinlik ID gerekli." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, message: "Geçerli bir e-posta adresi girin." },
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

    const { error } = await supabase.from("event_reminders").upsert(
      { event_id: eventId, email },
      { onConflict: "event_id,email" }
    );

    if (error) {
      console.error("Reminder insert error:", error);
      return NextResponse.json(
        { success: false, message: "Kayıt sırasında bir hata oluştu." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "E-posta adresiniz kaydedildi. Etkinlik öncesi size hatırlatma göndereceğiz.",
    });
  } catch (error) {
    console.error("Reminders API error:", error);
    return NextResponse.json(
      { success: false, message: "Bir hata oluştu." },
      { status: 500 }
    );
  }
}
