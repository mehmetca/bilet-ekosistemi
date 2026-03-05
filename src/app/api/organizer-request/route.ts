import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, email } = body as { user_id?: string; email?: string };

    if (!user_id || !email || typeof user_id !== "string" || typeof email !== "string") {
      return NextResponse.json(
        { error: "user_id ve email gerekli" },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Sunucu yapılandırma hatası" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // auth.users'a yazılma gecikmesi olabilir; FK hatası alırsak retry
    const maxAttempts = 5;
    const delays = [300, 500, 1000, 2000]; // ms bekleme (attempt 0 sonrası, 1 sonrası, ...)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, delays[attempt - 1]));
      }

      const { error: insertError } = await supabase.from("organizer_requests").insert({
        user_id,
        email: email.trim(),
        status: "pending",
      });

      if (!insertError) {
        return NextResponse.json({ success: true });
      }

      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Bu e-posta için zaten bir organizatör başvurusu mevcut" },
          { status: 409 }
        );
      }

      // FK violation (23503): user_id auth.users'da henüz yok, retry
      if (insertError.code === "23503" && attempt < maxAttempts - 1) {
        continue;
      }

      console.error("organizer_requests insert error:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Başvuru kaydedilemedi" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("organizer-request API error:", err);
    return NextResponse.json(
      { error: "Beklenmeyen hata" },
      { status: 500 }
    );
  }
}
