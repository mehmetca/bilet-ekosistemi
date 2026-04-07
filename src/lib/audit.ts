import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { supabase } from "@/lib/supabase-client";

export async function logAudit(params: {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
}) {
  try {
    // Önce tarayıcıdan kullanıcı bilgisini al
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;
    const userEmail = user?.email ?? null;
    
    console.log("[logAudit] Logging audit:", {
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      user_id: userId,
      user_email: userEmail,
    });
    
    // Admin client ile log kaydet (RLS bypass)
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      user_email: userEmail,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id ?? null,
      details: params.details ?? {},
    }).select();

    if (error) {
      console.error("[logAudit] Supabase insert error:", error);
    } else {
      console.log("[logAudit] Audit logged successfully:", data);
    }
  } catch (err) {
    console.error("[logAudit] Audit log failed:", err);
  }
}
