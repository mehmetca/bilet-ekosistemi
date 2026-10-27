import { NextRequest, NextResponse } from "next/server";
import { createBrevoClient, OutboundMailDisabled } from "@/lib/brevo-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { checkRateLimit, getClientIp, getRealIp } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";
import { loadMessagesWithEnFallback, type MessageTree } from "@/i18n/load-messages";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const IP_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_WINDOW_MS = 15 * 60 * 1000;
const APP_LOCALES = routing.locales as readonly string[];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readText(source: Record<string, unknown>, key: string, max: number): string {
  const value = source[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** GoTrue'dan dönen bağlantı alanlarından token_hash'i oku. */
function extractTokenHash(properties: { hashed_token?: string | null; action_link?: string | null } | null | undefined): string {
  if (properties?.hashed_token) return properties.hashed_token;
  if (properties?.action_link) {
    try {
      return new URL(properties.action_link).searchParams.get("token_hash") || "";
    } catch {
      return "";
    }
  }
  return "";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ success: false, reason: "Gövde geçersiz." }, { status: 400 });

  const email = readText(body, "email", 254).toLowerCase();
  if (!email || !validateEmail(email)) {
    return NextResponse.json({ success: false, reason: "E-posta adresi geçersiz." }, { status: 400 });
  }

  const rawLocale = readText(body, "locale", 10);
  const locale = APP_LOCALES.includes(rawLocale) ? rawLocale : routing.defaultLocale;

  const ip = getRealIp(request) || getClientIp(request) || "unknown";
  if (!checkRateLimit(ip, { name: "reset-link-ip", windowMs: IP_WINDOW_MS, max: 10 })) {
    return NextResponse.json({ success: false, reason: "Çok fazla istek." }, { status: 429 });
  }
  if (!checkRateLimit(email, { name: "reset-link-email", windowMs: EMAIL_WINDOW_MS, max: 3 })) {
    return NextResponse.json({ success: false, reason: "Çok fazla istek." }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();
  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  // Hesap yoksa da aynı yanıt döner: e-posta listesi çıkarma yolu kapalı kalsın.
  if (linkError || !link?.properties) {
    console.warn("sifre-sifirlama: generate_link başarısız:", linkError?.message?.slice(0, 120));
    return NextResponse.json({ success: true });
  }

  const tokenHash = extractTokenHash(link.properties);
  if (!tokenHash) {
    console.error("sifre-sifirlama: generate_link token döndürmedi");
    return NextResponse.json({ success: false, reason: "Bağlantı üretilemedi." }, { status: 502 });
  }

  const resetUrl = `${getSiteUrl()}/${locale}/sifre-yenile/?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;

  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME;
  if (!brevoApiKey || !fromEmail || !fromName) {
    console.error("Brevo ENV eksik: BREVO_API_KEY/BREVO_FROM_EMAIL/BREVO_FROM_NAME tanımsız.");
    return NextResponse.json({ success: false, reason: "Brevo yapılandırması eksik." }, { status: 500 });
  }

  let emailCopy: MessageTree = {};
  try {
    const messages = await loadMessagesWithEnFallback(locale);
    if (messages.passwordResetEmail && typeof messages.passwordResetEmail === "object" && !Array.isArray(messages.passwordResetEmail)) {
      emailCopy = messages.passwordResetEmail;
    }
  } catch {
    // Çeviri yüklenemezse aşağıdaki İngilizce varsayılanlar kullanılır.
  }
  const text = (key: string, fallback: string): string => {
    const value = emailCopy[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  };

  const htmlContent = [
    `<p>${escapeHtml(text("greeting", "Hello,"))}</p>`,
    `<p>${escapeHtml(text("intro", "You requested a link to reset your password."))}</p>`,
    `<p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#DC0B2C;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(text("cta", "Reset password"))}</a></p>`,
    `<p style="word-break:break-all;color:#666666;font-size:13px">${escapeHtml(resetUrl)}</p>`,
    `<p>${escapeHtml(text("expiry", "The link can be used once and expires shortly."))}</p>`,
    `<p>${escapeHtml(text("ignore", "If you did not request this, you can ignore this email; your password will not change."))}</p>`,
    `<p><strong>${escapeHtml(text("team", "KurdEvents Team"))}</strong></p>`,
  ].join("");

  try {
    const brevo = createBrevoClient(brevoApiKey);
    await brevo.transactionalEmails.sendTransacEmail({
      to: [{ email }],
      sender: { name: fromName, email: fromEmail },
      subject: text("subject", "KurdEvents – password reset link"),
      htmlContent,
    });
  } catch (error) {
    if (error instanceof OutboundMailDisabled) {
      return NextResponse.json({ success: false, reason: "Geliştirme ortamında gerçek e-posta gönderimi kapalı." }, { status: 503 });
    }
    console.error("sifre-sifirlama mail send error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, reason: "E-posta gönderilemedi." }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
