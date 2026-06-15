import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";

export type OrganizerRequest = {
  id?: string;
  user_id?: string;
  email?: string;
  status?: string;
  company_name?: string | null;
  legal_form?: string | null;
  address?: string | null;
  phone?: string | null;
  trade_register?: string | null;
  trade_register_number?: string | null;
  vat_id?: string | null;
  representative_name?: string | null;
  organization_display_name?: string | null;
  created_at?: string;
};

export type OrganizerApplicationInput = {
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

/** Kendi organizatör başvurusunu okur; onaylı profil fallback'i dahil. */
export async function fetchOrganizerRequest(user: User): Promise<OrganizerRequest | null> {
  const { data: reqData, error } = await supabase
    .from("organizer_requests")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!reqData) {
    const [profRes, upRes] = await Promise.all([
      supabase
        .from("organizer_profiles")
        .select("organization_display_name")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    if (profRes.data) {
      const repName = upRes.data
        ? [upRes.data.first_name, upRes.data.last_name].filter(Boolean).join(" ").trim() || null
        : null;
      return {
        email: user.email ?? undefined,
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
      };
    }
  }

  return reqData;
}

/** Yeni organizatör başvurusu — RLS ile doğrudan insert. */
export async function submitOrganizerApplication(
  user: User,
  body: OrganizerApplicationInput
): Promise<void> {
  if (!user.email) {
    throw new Error("Başvuru için doğrulanmış e-posta gerekli");
  }
  if (!body.terms_accepted) {
    throw new Error("Sözleşme ve kuralların kabul edilmesi zorunludur");
  }

  const maxAttempts = 5;
  const delays = [300, 500, 1000, 2000];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt - 1]));
    }

    const { error: insertError } = await supabase.from("organizer_requests").insert({
      user_id: user.id,
      email: user.email.trim(),
      status: "pending",
      company_name: body.company_name?.trim() || null,
      legal_form: body.legal_form?.trim() || null,
      address: body.address?.trim() || null,
      phone: body.phone?.trim() || null,
      trade_register: body.trade_register?.trim() || null,
      trade_register_number: body.trade_register_number?.trim() || null,
      vat_id: body.vat_id?.trim() || null,
      representative_name: body.representative_name?.trim() || null,
      organization_display_name: body.organization_display_name?.trim() || null,
      terms_accepted_at: new Date().toISOString(),
    });

    if (!insertError) return;

    if (insertError.code === "23505") {
      throw new Error("Bu e-posta için zaten bir organizatör başvurusu mevcut");
    }

    if (insertError.code === "23503" && attempt < maxAttempts - 1) {
      continue;
    }

    throw new Error(insertError.message || "Başvuru kaydedilemedi");
  }
}
