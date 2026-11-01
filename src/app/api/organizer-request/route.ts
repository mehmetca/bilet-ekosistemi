import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { publicErrorMessage } from "@/lib/api-error";
import { postalAddress } from "@/lib/organizer-address";

async function getSupabaseWithUser(request: NextRequest) {
  const supabase = getSupabaseAdmin();
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
      return NextResponse.json(
        { error: publicErrorMessage("Başvuru bilgisi alınamadı.", error) },
        { status: 500 }
      );
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
          street: null,
          postcode: null,
          city: null,
          country_code: null,
          address: null,
          phone: null,
          tax_number: null,
          invoice_email: null,
          logo_path: null,
          kleinunternehmer: false,
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
  street?: string;
  postcode?: string;
  city?: string;
  country_code?: string;
  phone?: string;
  tax_number?: string;
  invoice_email?: string;
  logo_path?: string;
  kleinunternehmer?: boolean;
  trade_register?: string;
  trade_register_number?: string;
  vat_id?: string;
  representative_name?: string;
  organization_display_name?: string;
  terms_accepted?: boolean;
};

const trimOrNull = (value?: string) => value?.trim() || null;

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
      street,
      postcode,
      city,
      country_code,
      phone,
      tax_number,
      invoice_email,
      logo_path,
      kleinunternehmer,
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
        street: street?.trim() || null,
        postcode: postcode?.trim() || null,
        city: city?.trim() || null,
        country_code: country_code?.trim().toUpperCase() || null,
        address: postalAddress({ street, postcode, city, country_code }),
        phone: phone?.trim() || null,
        tax_number: tax_number?.trim() || null,
        invoice_email: invoice_email?.trim() || null,
        logo_path: logo_path?.trim() || null,
        kleinunternehmer: Boolean(kleinunternehmer),
        trade_register: trade_register?.trim() || null,
        trade_register_number: trade_register_number?.trim() || null,
        vat_id: vat_id?.trim().replace(/\s+/g, "").toUpperCase() || null,
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
      street,
      postcode,
      city,
      country_code,
      phone,
      tax_number,
      invoice_email,
      logo_path,
      kleinunternehmer,
      trade_register,
      trade_register_number,
      vat_id,
      representative_name,
      organization_display_name,
    } = body;

    const adminSupabase = getSupabaseAdmin();

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

    const addressPartsGiven =
      street !== undefined || postcode !== undefined || city !== undefined || country_code !== undefined;

    const updates: Record<string, unknown> = {
      legal_form: legal_form !== undefined ? trimOrNull(legal_form) : undefined,
      street: street !== undefined ? trimOrNull(street) : undefined,
      postcode: postcode !== undefined ? trimOrNull(postcode) : undefined,
      city: city !== undefined ? trimOrNull(city) : undefined,
      country_code:
        country_code !== undefined ? trimOrNull(country_code?.toUpperCase()) : undefined,
      address: addressPartsGiven
        ? postalAddress({ street, postcode, city, country_code })
        : undefined,
      phone: phone !== undefined ? trimOrNull(phone) : undefined,
      tax_number: tax_number !== undefined ? trimOrNull(tax_number) : undefined,
      invoice_email: invoice_email !== undefined ? trimOrNull(invoice_email) : undefined,
      logo_path: logo_path !== undefined ? trimOrNull(logo_path) : undefined,
      kleinunternehmer: kleinunternehmer !== undefined ? Boolean(kleinunternehmer) : undefined,
      trade_register: trade_register !== undefined ? trimOrNull(trade_register) : undefined,
      trade_register_number:
        trade_register_number !== undefined ? trimOrNull(trade_register_number) : undefined,
      vat_id: vat_id !== undefined ? trimOrNull(vat_id?.replace(/\s+/g, "").toUpperCase()) : undefined,
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
    ) as Record<string, unknown>;

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
            organization_display_name:
              String(cleanUpdates.organization_display_name || "") || "Organizatör",
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
        company_name: trimOrNull(company_name),
        legal_form: trimOrNull(legal_form),
        street: trimOrNull(street),
        postcode: trimOrNull(postcode),
        city: trimOrNull(city),
        country_code: trimOrNull(country_code?.toUpperCase()),
        address: postalAddress({ street, postcode, city, country_code }),
        phone: trimOrNull(phone),
        tax_number: trimOrNull(tax_number),
        invoice_email: trimOrNull(invoice_email),
        logo_path: trimOrNull(logo_path),
        kleinunternehmer: Boolean(kleinunternehmer),
        trade_register: trimOrNull(trade_register),
        trade_register_number: trimOrNull(trade_register_number),
        vat_id: trimOrNull(vat_id?.replace(/\s+/g, "").toUpperCase()),
        representative_name: trimOrNull(representative_name),
        organization_display_name: trimOrNull(organization_display_name) || "Organizatör",
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
