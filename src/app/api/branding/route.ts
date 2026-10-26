import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { logAuditServer } from "@/lib/audit";
import { getRealIp } from "@/lib/rate-limit";
import { routing } from "@/i18n/routing";
import {
  BRANDING_SETTINGS_KEY,
  getBranding,
  normalizeBranding,
  type Branding,
} from "@/lib/branding";

export const dynamic = "force-dynamic";

export async function GET() {
  const branding = await getBranding();
  return NextResponse.json(branding, {
    headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as Partial<Branding>;
  const branding = normalizeBranding(body);

  const { error } = await getSupabaseAdmin()
    .from("site_settings")
    .upsert({ key: BRANDING_SETTINGS_KEY, value: branding }, { onConflict: "key" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("branding");
  revalidateTag("home");
  revalidatePath("/", "layout");
  for (const locale of routing.locales) revalidatePath(`/${locale}`, "layout");

  await logAuditServer({
    action: "update",
    entity_type: "branding_logos",
    details: branding,
    user_id: auth.user.id,
    user_email: auth.user.email ?? null,
    ip_address: getRealIp(request),
  });

  return NextResponse.json({ success: true, ...branding });
}
