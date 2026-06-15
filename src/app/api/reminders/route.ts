import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

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

    const supabase = createServerSupabase();

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
