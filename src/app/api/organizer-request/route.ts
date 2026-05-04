import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function getSupabaseWithUser(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  const supabase = createClient(url, key);
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return { supabase, user: null };
  const { data: { user } } = await supabase.auth.getUser(token);
  return { supabase, user };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseWithUser(request);
    if (!user) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    const { data: reqData, error } = await supabase
      .from("organizer_requests")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Organizatör ama organizer_requests boşsa (admin tarafından eklenmiş olabilir) organizer_profiles + user_profiles'dan al
    if (!reqData) {
      const [profRes, upRes] = await Promise.all([
        supabase.from("organizer_profiles").select("organization_display_name").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_profiles").select("first_name, last_name").eq("user_id", user.id).maybeSingle(),
      ]);
      if (profRes.data) {
        const repName = upRes.data
          ? [upRes.data.first_name, upRes.data.last_name].filter(Boolean).join(" ").trim() || null
          : null;
        return NextResponse.json({
          email: user.email,
          status: "approved",
          organization_display_name: profRes.data.organization_display_name,
          company_name: null,
          legal_form: null,
          address: null,
          phone: null,
          trade_register: null,
          trade_register_number: null,
          vat_id: null,
          representative_name: repName,
        });
      }
    }
    return NextResponse.json(reqData || null);
  } catch (err) {
    console.error("organizer-request GET error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

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
    const { supabase, user } = await getSupabaseWithUser(request);
    if (!user) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }

    const body = (await request.json()) as OrganizerRequestBody;
    const {
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

    if (!user.email) {
      return NextResponse.json(
        { error: "Başvuru için doğrulanmış e-posta gerekli" },
        { status: 400 }
      );
    }

    if (!terms_accepted) {
      return NextResponse.json(
        { error: "Sözleşme ve kuralların kabul edilmesi zorunludur" },
        { status: 400 }
      );
    }

    // auth.users'a yazılma gecikmesi olabilir; FK hatası alırsak retry
    const maxAttempts = 5;
    const delays = [300, 500, 1000, 2000]; // ms bekleme (attempt 0 sonrası, 1 sonrası, ...)

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, delays[attempt - 1]));
      }

      const { error: insertError } = await supabase.from("organizer_requests").insert({
        user_id: user.id,
        email: user.email.trim(),
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

/** Organizatör kendi bilgilerini güncelleyebilir (onaylı organizatörler) */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await getSupabaseWithUser(request);
    if (!user) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    const body = (await request.json()) as Partial<OrganizerRequestBody>;
    const {
      company_name,
      legal_form,
      address,
      phone,
      trade_register,
      trade_register_number,
      vat_id,
      representative_name,
      organization_display_name,
    } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Sunucu yapılandırma hatası" }, { status: 500 });
    }

    const adminSupabase = createClient(supabaseUrl, serviceKey);

    const { data: roleRow } = await adminSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "organizer")
      .maybeSingle();
    if (!roleRow) {
      return NextResponse.json({ error: "Organizatör yetkisi gerekli" }, { status: 403 });
    }

    const { data: existing } = await adminSupabase
      .from("organizer_requests")
      .select("id, company_name, representative_name, organization_display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const updates: Record<string, unknown> = {
      legal_form: legal_form !== undefined ? (legal_form?.trim() || null) : undefined,
      address: address !== undefined ? (address?.trim() || null) : undefined,
      phone: phone !== undefined ? (phone?.trim() || null) : undefined,
      trade_register: trade_register !== undefined ? (trade_register?.trim() || null) : undefined,
      trade_register_number: trade_register_number !== undefined ? (trade_register_number?.trim() || null) : undefined,
      vat_id: vat_id !== undefined ? (vat_id?.trim() || null) : undefined,
    };

    if (company_name !== undefined) {
      const cur = existing?.company_name;
      if (!cur || cur.trim() === "") updates.company_name = company_name?.trim() || null;
    }
    if (representative_name !== undefined) {
      const cur = existing?.representative_name;
      if (!cur || cur.trim() === "") updates.representative_name = representative_name?.trim() || null;
    }
    if (organization_display_name !== undefined) {
      const cur = existing?.organization_display_name;
      if (!cur || cur.trim() === "") updates.organization_display_name = organization_display_name?.trim() || null;
    }

    delete updates.undefined;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    ) as Record<string, string | null>;

    if (existing) {
      if (Object.keys(cleanUpdates).length > 0) {
        const { error: updErr } = await adminSupabase
          .from("organizer_requests")
          .update(cleanUpdates)
          .eq("user_id", user.id);
        if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 500 });
        }
      }
      if (cleanUpdates.organization_display_name !== undefined) {
        await adminSupabase.from("organizer_profiles").upsert(
          {
            user_id: user.id,
            organization_display_name: cleanUpdates.organization_display_name || "Organizatör",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }
    } else {
      const insertRow = {
        user_id: user.id,
        email: user.email || "",
        status: "approved",
        company_name: company_name?.trim() || null,
        legal_form: legal_form?.trim() || null,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        trade_register: trade_register?.trim() || null,
        trade_register_number: trade_register_number?.trim() || null,
        vat_id: vat_id?.trim() || null,
        representative_name: representative_name?.trim() || null,
        organization_display_name: organization_display_name?.trim() || "Organizatör",
      };
      const { error: insErr } = await adminSupabase.from("organizer_requests").insert(insertRow);
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      await adminSupabase.from("organizer_profiles").upsert(
        {
          user_id: user.id,
          organization_display_name: insertRow.organization_display_name,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }

    const { data: updated } = await adminSupabase
      .from("organizer_requests")
      .select("*")
      .eq("user_id", user.id)
      .single();
    return NextResponse.json(updated);
  } catch (err) {
    console.error("organizer-request PATCH error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
