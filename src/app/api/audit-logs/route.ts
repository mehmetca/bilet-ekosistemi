import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { requireRole } from "@/lib/api-auth";
import { publicErrorMessage } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["admin", "controller"]);
  if (auth instanceof Response) return auth;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Audit logs fetch error:", error);
      return NextResponse.json(
        { error: publicErrorMessage("Denetim kayıtları alınamadı.", error) },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("Audit logs API error:", err);
    return NextResponse.json(
      { error: publicErrorMessage("Sunucu hatası", err instanceof Error ? err : null) },
      { status: 500 }
    );
  }
}
