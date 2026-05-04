import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireRole } from "@/lib/api-auth";

const MAX_ACTION_LENGTH = 80;
const MAX_ENTITY_TYPE_LENGTH = 80;

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["admin", "controller", "organizer"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { action, entity_type, entity_id, details } = body as {
      action: string;
      entity_type: string;
      entity_id?: string;
      details?: Record<string, unknown>;
    };

    const actionTrimmed = typeof action === "string" ? action.trim() : "";
    const entityTypeTrimmed = typeof entity_type === "string" ? entity_type.trim() : "";

    if (
      !actionTrimmed ||
      !entityTypeTrimmed ||
      actionTrimmed.length > MAX_ACTION_LENGTH ||
      entityTypeTrimmed.length > MAX_ENTITY_TYPE_LENGTH
    ) {
      return NextResponse.json({ error: "action ve entity_type gerekli" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") || null;

    await supabase.from("audit_logs").insert({
      user_id: auth.user.id,
      user_email: auth.user.email ?? null,
      action: actionTrimmed,
      entity_type: entityTypeTrimmed,
      entity_id: entity_id || null,
      details: details && typeof details === "object" && !Array.isArray(details) ? details : {},
      ip_address: ip,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Audit log error:", err);
    return NextResponse.json({ error: "Log yazılamadı" }, { status: 500 });
  }
}
