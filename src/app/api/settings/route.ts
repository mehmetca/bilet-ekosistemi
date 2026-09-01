import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase-server";
import { DATA_CACHE_REVALIDATE } from "@/lib/server-data-cache";
import { revalidateSiteSettingsCache } from "@/lib/revalidate-public-cache";
import { applyMaintenanceCookie, setMaintenanceModeCache } from "@/lib/maintenance-mode";
import { logAuditServer } from "@/lib/audit";

export const revalidate = 3600;

const DEFAULT_MAX_TICKET_QUANTITY = 10;
const DEFAULT_SOCIAL_LINKS = [
  { platform: "instagram", url: "https://instagram.com/kurdeventofficial" },
  { platform: "facebook", url: "https://www.facebook.com/KurdEventOfficial" },
  { platform: "twitter", url: "https://twitter.com/Kurd_Event" },
  { platform: "youtube", url: "https://youtube.com/@kurdevent" },
];

const DEFAULT_IMPRESSUM = {
  companyName: "White de Soul GmbH",
  addressValue: "Schulstraße 35\n31708 Ahnsen\nDeutschland",
  registrationValue: "HRB 201659 (Registergericht: Amtsgericht Stadthagen)",
  vatIdValue: "DE 32 6783 412",
  emails: "hallo@kurdevents.org, eventseat21@gmail.com, whitedesoul@gmail.com",
  phoneValue: "+49 1724 395 385",
  responsibleValue: "Herr Özgül Adsiz",
  disputeDesc: "AB tüketicileri, çevrimiçi uyuşmazlık çözüm platformunu kullanabilir: https://www.verbraucher-schlichter.de/",
};

const DEFAULT_SETTINGS = {
  siteName: "KurdEvents",
  siteDescription: "Modern bilet satış platformu",
  contactEmail: "info@kurdevents.com",
  maxTicketQuantity: DEFAULT_MAX_TICKET_QUANTITY,
  enableNotifications: true,
  maintenanceMode: false,
  socialLinks: DEFAULT_SOCIAL_LINKS,
  impressum: DEFAULT_IMPRESSUM,
  amedSporFormNotifyEmails: [] as string[],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeNotifyEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const email = item.trim().toLowerCase();
    if (EMAIL_RE.test(email) && !out.includes(email)) out.push(email);
  }
  return out;
}

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

  const rawSocial = byKey.get("social_links");
  let socialLinks = DEFAULT_SOCIAL_LINKS;
  if (Array.isArray(rawSocial)) {
    socialLinks = rawSocial
      .filter(
        (item: any) =>
          item &&
          typeof item === "object" &&
          typeof item.platform === "string" &&
          typeof item.url === "string"
      )
      .map((item: any) => ({
        platform: String(item.platform).trim(),
        url: String(item.url).trim(),
      }));
  }

  const rawImpressum = byKey.get("impressum_settings");
  let impressum = DEFAULT_IMPRESSUM;
  if (rawImpressum && typeof rawImpressum === "object") {
    const imp = rawImpressum as Record<string, unknown>;
    impressum = {
      companyName: typeof imp.companyName === "string" ? imp.companyName : DEFAULT_IMPRESSUM.companyName,
      addressValue: typeof imp.addressValue === "string" ? imp.addressValue : DEFAULT_IMPRESSUM.addressValue,
      registrationValue: typeof imp.registrationValue === "string" ? imp.registrationValue : DEFAULT_IMPRESSUM.registrationValue,
      vatIdValue: typeof imp.vatIdValue === "string" ? imp.vatIdValue : DEFAULT_IMPRESSUM.vatIdValue,
      emails: typeof imp.emails === "string" ? imp.emails : DEFAULT_IMPRESSUM.emails,
      phoneValue: typeof imp.phoneValue === "string" ? imp.phoneValue : DEFAULT_IMPRESSUM.phoneValue,
      responsibleValue: typeof imp.responsibleValue === "string" ? imp.responsibleValue : DEFAULT_IMPRESSUM.responsibleValue,
      disputeDesc: typeof imp.disputeDesc === "string" ? imp.disputeDesc : DEFAULT_IMPRESSUM.disputeDesc,
    };
  }

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
    socialLinks,
    impressum,
    amedSporFormNotifyEmails: normalizeNotifyEmails(byKey.get("amed_spor_form_notify_emails")),
  };
}

/** Herkese açık: maksimum bilet adedi vb. ayarları döner */
async function fetchPublicSettings(): Promise<SettingsResponse> {
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
      "social_links",
      "impressum_settings",
      "amed_spor_form_notify_emails",
    ]);

  if (error) return DEFAULT_SETTINGS;
  return normalizeSettings(data as SiteSettingRow[]);
}

const getPublicSettingsCached = unstable_cache(fetchPublicSettings, ["public-site-settings"], {
  revalidate: DATA_CACHE_REVALIDATE.settings,
  tags: ["site-settings"],
});

export async function GET() {
  try {
    const settings = await getPublicSettingsCached();
    return NextResponse.json(settings, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
  } catch {
    return NextResponse.json(DEFAULT_SETTINGS, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    });
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

    const supabase = getSupabaseAdmin();

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
    const socialLinks = Array.isArray(body.socialLinks)
      ? body.socialLinks
          .filter(
            (item: any) =>
              item && typeof item.platform === "string" && typeof item.url === "string"
          )
          .map((item: any) => ({
            platform: String(item.platform).trim().toLowerCase(),
            url: String(item.url).trim(),
          }))
      : undefined;
    const impressum =
      body.impressum && typeof body.impressum === "object"
        ? {
            companyName: String(body.impressum.companyName || "").trim(),
            addressValue: String(body.impressum.addressValue || "").trim(),
            registrationValue: String(body.impressum.registrationValue || "").trim(),
            vatIdValue: String(body.impressum.vatIdValue || "").trim(),
            emails: String(body.impressum.emails || "").trim(),
            phoneValue: String(body.impressum.phoneValue || "").trim(),
            responsibleValue: String(body.impressum.responsibleValue || "").trim(),
            disputeDesc: String(body.impressum.disputeDesc || "").trim(),
          }
        : undefined;
    const amedSporFormNotifyEmails = normalizeNotifyEmails(body.amedSporFormNotifyEmails);

    if (
      siteName === undefined ||
      siteDescription === undefined ||
      contactEmail === undefined ||
      maxTicketQuantity === undefined ||
      enableNotifications === undefined ||
      maintenanceMode === undefined ||
      socialLinks === undefined ||
      impressum === undefined ||
      !Array.isArray(body.amedSporFormNotifyEmails)
    ) {
      return NextResponse.json(
        { error: "Ayar alanları geçersiz. Tüm alanları doğru formatta gönderin." },
        { status: 400 }
      );
    }

    if (amedSporFormNotifyEmails.length < 1) {
      return NextResponse.json(
        {
          error:
            "Amed Spor form bildirimleri için en az 1 geçerli e-posta adresi girin.",
        },
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
      { key: "social_links", value: socialLinks },
      { key: "impressum_settings", value: impressum },
      { key: "amed_spor_form_notify_emails", value: amedSporFormNotifyEmails },
    ];

    const { error: upsertError } = await supabase
      .from("site_settings")
      .upsert(rowsToUpsert, { onConflict: "key" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    revalidateSiteSettingsCache();
    setMaintenanceModeCache(maintenanceMode);

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    await logAuditServer({
      action: "update",
      entity_type: "site_settings",
      details: {
        siteName,
        contactEmail,
        maxTicketQuantity,
        enableNotifications,
        maintenanceMode,
        socialLinks,
        impressum,
        amedSporFormNotifyEmails,
      },
      user_id: user.id,
      user_email: user.email ?? null,
      ip_address: ip,
    });

    const res = NextResponse.json({
      success: true,
      ...DEFAULT_SETTINGS,
      ...{
        siteName,
        siteDescription,
        contactEmail,
        maxTicketQuantity,
        enableNotifications,
        maintenanceMode,
        socialLinks,
        impressum,
        amedSporFormNotifyEmails,
      },
    });
    applyMaintenanceCookie(res, maintenanceMode);
    return res;
  } catch (e) {
    console.error("Settings POST error:", e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
