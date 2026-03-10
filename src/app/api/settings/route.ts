import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

const DEFAULT_MAX_TICKET_QUANTITY = 10;

/** Herkese açık: maksimum bilet adedi vb. ayarları döner */
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["max_ticket_quantity"]);

    if (error) {
      return NextResponse.json(
        { maxTicketQuantity: DEFAULT_MAX_TICKET_QUANTITY },
        { status: 200 }
      );
    }

    const row = (data || []).find((r) => r.key === "max_ticket_quantity");
    const maxTicketQuantity =
      row && typeof row.value === "number"
        ? Math.max(1, Math.min(100, row.value))
        : DEFAULT_MAX_TICKET_QUANTITY;

    return NextResponse.json({ maxTicketQuantity });
  } catch {
    return NextResponse.json(
      { maxTicketQuantity: DEFAULT_MAX_TICKET_QUANTITY },
      { status: 200 }
    );
  }
}

/** Sadece admin: ayarları günceller */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "").trim();
    if (!token) {
      return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Sunucu yapılandırması eksik" }, { status: 500 });
    }

    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Oturum geçersiz" }, { status: 401 });
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
    if (!isAdmin) {
      return NextResponse.json({ error: "Bu işlem için admin yetkisi gerekir" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const maxTicketQuantity =
      typeof body.maxTicketQuantity === "number"
        ? Math.max(1, Math.min(100, Math.floor(body.maxTicketQuantity)))
        : undefined;

    if (maxTicketQuantity === undefined) {
      return NextResponse.json({ error: "maxTicketQuantity sayı olmalı (1–100)" }, { status: 400 });
    }

    const { error: upsertError } = await supabase
      .from("site_settings")
      .upsert({ key: "max_ticket_quantity", value: maxTicketQuantity }, { onConflict: "key" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, maxTicketQuantity });
  } catch (e) {
    console.error("Settings POST error:", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
