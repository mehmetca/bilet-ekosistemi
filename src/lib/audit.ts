import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getAccessTokenForApi } from "@/lib/supabase-auth-token";

export type AuditLogParams = {
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, unknown>;
  user_id?: string | null;
  user_email?: string | null;
  ip_address?: string | null;
};

/** Sunucu (API route): kritik işlem kaydı. */
export async function logAuditServer(params: AuditLogParams): Promise<void> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin.from("audit_logs").insert({
      user_id: params.user_id ?? null,
      user_email: params.user_email ?? null,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id ?? null,
      details: params.details ?? {},
      ip_address: params.ip_address ?? null,
    });
    if (error) {
      console.error("[logAuditServer] insert error:", error);
    }
  } catch (err) {
    console.error("[logAuditServer] failed:", err);
  }
}

/**
 * Tarayıcı: /api/audit üzerinden kaydeder (service role istemciye sızmaz).
 * Başarısız olsa bile ana işlemi bozmaz.
 */
export async function logAudit(params: {
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const token = await getAccessTokenForApi();
    if (!token) {
      console.warn("[logAudit] Oturum yok, kayıt atlandı.");
      return;
    }
    const res = await fetch("/api/audit", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: params.action,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        details: params.details ?? {},
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      console.error("[logAudit] API error:", payload);
    }
  } catch (err) {
    console.error("[logAudit] failed:", err);
  }
}
