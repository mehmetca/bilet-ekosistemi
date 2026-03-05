import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function getSupabaseServer(request: NextRequest) {
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
    const { supabase, user } = await getSupabaseServer(request);
    if (!user) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data || null);
  } catch (err) {
    console.error("profile GET error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

type ProfileBody = {
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

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getSupabaseServer(request);
    if (!user) {
      return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
    }
    const body = (await request.json()) as ProfileBody;
    const {
      anrede,
      first_name,
      last_name,
      firma,
      address,
      plz,
      city,
      ort,
      country,
      email,
      telefon,
      handynummer,
      geburtsdatum,
    } = body;

    const { data: existing } = await supabase
      .from("user_profiles")
      .select("id, kundennummer")
      .eq("user_id", user.id)
      .maybeSingle();

    const kundennummer =
      existing?.kundennummer ||
      (() => {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const f = (first_name || "").trim().charAt(0).toUpperCase();
        const l = (last_name || "").trim().charAt(0).toUpperCase();
        const initials = (f && l) ? f + l : (f || l) || "XX";
        const suffix = user.id.replace(/-/g, "").slice(-4).toUpperCase();
        return today + initials + suffix;
      })();

    const row = {
      user_id: user.id,
      kundennummer,
      anrede: anrede || null,
      first_name: first_name || null,
      last_name: last_name || null,
      firma: firma || null,
      address: address || null,
      plz: plz || null,
      city: city || null,
      ort: ort || null,
      country: country || null,
      email: email || user.email || null,
      telefon: telefon || null,
      handynummer: handynummer || null,
      geburtsdatum: geburtsdatum || null,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updErr } = await supabase
        .from("user_profiles")
        .update(row)
        .eq("user_id", user.id);
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    } else {
      const { error: insErr } = await supabase.from("user_profiles").insert(row);
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    }

    const { data: updated } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json(updated);
  } catch (err) {
    console.error("profile POST error:", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
