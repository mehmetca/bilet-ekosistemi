import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type OrganizerRequestBody = {
  user_id?: string;
  email?: string;
  company_name?: string;
  legal_form?: string;
  address?: string;
  phone?: string;
  trade_register?: string;
  trade_register_number?: string;
  vat_id?: string;
  representative_name?: string;
  organization_display_name?: string;
  terms_accepted?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OrganizerRequestBody;
    const {
      user_id,
      email,
      company_name,
      legal_form,
      address,
      phone,
      trade_register,
      trade_register_number,
      vat_id,
      representative_name,
      organization_display_name,
      terms_accepted,
    } = body;

    if (!user_id || !email || typeof user_id !== "string" || typeof email !== "string") {
      return NextResponse.json(
        { error: "user_id ve email gerekli" },
        { status: 400 }
      );
    }

    if (!terms_accepted) {
      return NextResponse.json(
        { error: "Sözleşme ve kuralların kabul edilmesi zorunludur" },
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
        company_name: company_name?.trim() || null,
        legal_form: legal_form?.trim() || null,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        trade_register: trade_register?.trim() || null,
        trade_register_number: trade_register_number?.trim() || null,
        vat_id: vat_id?.trim() || null,
        representative_name: representative_name?.trim() || null,
        organization_display_name: organization_display_name?.trim() || null,
        terms_accepted_at: new Date().toISOString(),
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
