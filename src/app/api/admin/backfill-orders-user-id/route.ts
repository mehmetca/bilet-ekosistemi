import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Admin: user_id boş kalmış siparişleri, alıcı e-postası auth.users ile aynı olanlarda hesaba bağlar.
 * POST (body yok). Sadece admin.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["admin"]);
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_backfill_orders_user_id");

  if (error) {
    console.error("admin_backfill_orders_user_id:", error);
    return NextResponse.json(
      {
        error:
          "İşlem yapılamadı. Supabase’de 088 migration uygulanmış mı kontrol edin veya yöneticiye bildirin.",
        detail: error.message,
      },
      { status: 500 }
    );
  }

  const updated = typeof data === "number" ? data : Number(data);
  return NextResponse.json({
    updated: Number.isFinite(updated) ? updated : 0,
    message:
      updated === 0
        ? "Güncellenecek kayıt yok (zaten bağlı veya e-posta eşleşmesi yok)."
        : `${updated} sipariş hesaba bağlandı.`,
  });
}
