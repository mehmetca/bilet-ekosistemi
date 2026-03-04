import { supabase } from "@/lib/supabase-client";

export async function logAudit(params: {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id ?? null,
      details: params.details ?? {},
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
