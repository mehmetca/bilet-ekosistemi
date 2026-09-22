import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: IP başına dakikada 10 kayıt (spam koruması)
    const ip = getClientIp(request);
    if (!checkRateLimit(ip, { name: "reminders", windowMs: 60_000, max: 10 })) {
      return NextResponse.json(
        { success: false, message: "Çok fazla istek. Lütfen bekleyin." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

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

    const supabase = getSupabaseAdmin();

    // Zaten kayıtlıysa tekrar kaydetmeye gerek yok (2. kayıt denemesi hata döndürmesin).
    const { error } = await supabase.from("event_reminders").upsert(
      { event_id: eventId, email },
      { onConflict: "event_id,email", ignoreDuplicates: true }
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
