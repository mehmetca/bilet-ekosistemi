import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

const DEFAULT_MAX_TICKET_QUANTITY = 10;
const DEFAULT_SETTINGS = {
  siteName: "EventSeat",
  siteDescription: "Modern bilet satış platformu",
  contactEmail: "info@eventseat.com",
  maxTicketQuantity: DEFAULT_MAX_TICKET_QUANTITY,
  enableNotifications: true,
  maintenanceMode: false,
};

type SettingsResponse = typeof DEFAULT_SETTINGS;

type SiteSettingRow = {
  key: string;
  value: unknown;
};

function normalizeSettings(rows: SiteSettingRow[] | null | undefined): SettingsResponse {
  const byKey = new Map((rows || []).map((row) => [row.key, row.value]));
  const rawMax = byKey.get("max_ticket_quantity");
  const maxTicketQuantity =
    typeof rawMax === "number"
      ? Math.max(1, Math.min(100, Math.floor(rawMax)))
      : DEFAULT_MAX_TICKET_QUANTITY;

  return {
    siteName: typeof byKey.get("site_name") === "string" ? String(byKey.get("site_name")) : DEFAULT_SETTINGS.siteName,
    siteDescription:
      typeof byKey.get("site_description") === "string"
        ? String(byKey.get("site_description"))
        : DEFAULT_SETTINGS.siteDescription,
    contactEmail:
      typeof byKey.get("contact_email") === "string"
        ? String(byKey.get("contact_email"))
        : DEFAULT_SETTINGS.contactEmail,
    maxTicketQuantity,
    enableNotifications:
      typeof byKey.get("enable_notifications") === "boolean"
        ? Boolean(byKey.get("enable_notifications"))
        : DEFAULT_SETTINGS.enableNotifications,
    maintenanceMode:
      typeof byKey.get("maintenance_mode") === "boolean"
        ? Boolean(byKey.get("maintenance_mode"))
        : DEFAULT_SETTINGS.maintenanceMode,
  };
}

/** Herkese açık: maksimum bilet adedi vb. ayarları döner */
export async function GET() {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "site_name",
        "site_description",
        "contact_email",
        "max_ticket_quantity",
        "enable_notifications",
        "maintenance_mode",
      ]);

    if (error) {
      return NextResponse.json(DEFAULT_SETTINGS, { status: 200 });
    }

    return NextResponse.json(normalizeSettings(data as SiteSettingRow[]));
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS, { status: 200 });
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
    const siteName =
      typeof body.siteName === "string" && body.siteName.trim().length > 0
        ? body.siteName.trim()
        : undefined;
    const siteDescription =
      typeof body.siteDescription === "string" && body.siteDescription.trim().length > 0
        ? body.siteDescription.trim()
        : undefined;
    const contactEmail =
      typeof body.contactEmail === "string" && body.contactEmail.trim().length > 0
        ? body.contactEmail.trim()
        : undefined;
    const maxTicketQuantity =
      typeof body.maxTicketQuantity === "number"
        ? Math.max(1, Math.min(100, Math.floor(body.maxTicketQuantity)))
        : undefined;
    const enableNotifications =
      typeof body.enableNotifications === "boolean" ? body.enableNotifications : undefined;
    const maintenanceMode =
      typeof body.maintenanceMode === "boolean" ? body.maintenanceMode : undefined;

    if (
      siteName === undefined ||
      siteDescription === undefined ||
      contactEmail === undefined ||
      maxTicketQuantity === undefined ||
      enableNotifications === undefined ||
      maintenanceMode === undefined
    ) {
      return NextResponse.json(
        { error: "Ayar alanları geçersiz. Tüm alanları doğru formatta gönderin." },
        { status: 400 }
      );
    }

    const rowsToUpsert = [
      { key: "site_name", value: siteName },
      { key: "site_description", value: siteDescription },
      { key: "contact_email", value: contactEmail },
      { key: "max_ticket_quantity", value: maxTicketQuantity },
      { key: "enable_notifications", value: enableNotifications },
      { key: "maintenance_mode", value: maintenanceMode },
    ];

    const { error: upsertError } = await supabase
      .from("site_settings")
      .upsert(rowsToUpsert, { onConflict: "key" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ...DEFAULT_SETTINGS,
      ...{
        siteName,
        siteDescription,
        contactEmail,
        maxTicketQuantity,
        enableNotifications,
        maintenanceMode,
      },
    });
  } catch (e) {
    console.error("Settings POST error:", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
