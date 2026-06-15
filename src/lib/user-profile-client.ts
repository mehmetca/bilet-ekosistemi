import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";

export type UserProfile = {
  id?: string;
  user_id?: string;
  kundennummer?: string | null;
  anrede?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  firma?: string | null;
  address?: string | null;
  plz?: string | null;
  city?: string | null;
  ort?: string | null;
  country?: string | null;
  email?: string | null;
  telefon?: string | null;
  handynummer?: string | null;
  geburtsdatum?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type UserProfileInput = {
  anrede?: string;
  first_name?: string;
  last_name?: string;
  firma?: string;
  address?: string;
  plz?: string;
  city?: string;
  ort?: string;
  country?: string;
  email?: string;
  telefon?: string;
  handynummer?: string;
  geburtsdatum?: string;
};

function buildKundennummer(
  user: User,
  firstName?: string | null,
  lastName?: string | null,
  existing?: string | null
): string {
  if (existing?.trim()) return existing.trim();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const f = (firstName || "").trim().charAt(0).toUpperCase();
  const l = (lastName || "").trim().charAt(0).toUpperCase();
  const initials = f && l ? f + l : f || l || "XX";
  const suffix = user.id.replace(/-/g, "").slice(-4).toUpperCase();
  return today + initials + suffix;
}

/** Tarayıcıdan doğrudan Supabase — RLS ile kendi profilini okur. */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Profil oluşturur veya günceller (kundennummer otomatik). */
export async function upsertUserProfile(user: User, body: UserProfileInput): Promise<UserProfile> {
  const { data: existing, error: fetchErr } = await supabase
    .from("user_profiles")
    .select("id, kundennummer")
    .eq("user_id", user.id)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);

  const kundennummer = buildKundennummer(user, body.first_name, body.last_name, existing?.kundennummer);

  const row = {
    user_id: user.id,
    kundennummer,
    anrede: body.anrede || null,
    first_name: body.first_name || null,
    last_name: body.last_name || null,
    firma: body.firma || null,
    address: body.address || null,
    plz: body.plz || null,
    city: body.city || null,
    ort: body.ort || null,
    country: body.country || null,
    email: body.email || user.email || null,
    telefon: body.telefon || null,
    handynummer: body.handynummer || null,
    geburtsdatum: body.geburtsdatum || null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error: updErr } = await supabase.from("user_profiles").update(row).eq("user_id", user.id);
    if (updErr) throw new Error(updErr.message);
  } else {
    const { error: insErr } = await supabase.from("user_profiles").insert(row);
    if (insErr) throw new Error(insErr.message);
  }

  const { data: updated, error: readErr } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (readErr) throw new Error(readErr.message);
  return updated;
}

/** Kundennummer yoksa minimal profil satırı oluşturur. */
export async function ensureUserProfile(
  user: User,
  partial?: UserProfileInput
): Promise<UserProfile | null> {
  const existing = await fetchUserProfile(user.id);
  if (existing?.kundennummer) return existing;
  return upsertUserProfile(user, { email: user.email || undefined, ...partial });
}

/** Şifre güncelleme — sunucu API yerine Supabase Auth istemcisi. */
export async function updateUserPassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
