import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Config eksik" }, { status: 500 });
    }

    const body = await request.json();
    const { action, entity_type, entity_id, details } = body as {
      action: string;
      entity_type: string;
      entity_id?: string;
      details?: Record<string, unknown>;
    };

    if (!action || !entity_type) {
      return NextResponse.json({ error: "action ve entity_type gerekli" }, { status: 400 });
    }

    const authHeader = request.headers.get("authorization");
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        userEmail = user.email ?? null;
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") || null;

    await supabase.from("audit_logs").insert({
      user_id: userId,
      user_email: userEmail,
      action,
      entity_type,
      entity_id: entity_id || null,
      details: details || {},
      ip_address: ip,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Audit log error:", err);
    return NextResponse.json({ error: "Log yazılamadı" }, { status: 500 });
  }
}
