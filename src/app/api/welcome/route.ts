import { NextRequest, NextResponse } from "next/server";
import { createBrevoClient } from "@/lib/brevo-client";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getAuthToken } from "@/lib/api-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sanitizeString, validateEmail } from "@/lib/validation";
import { loadMessagesWithEnFallback, type MessageTree } from "@/i18n/load-messages";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const IP_WINDOW_MS = 60 * 60 * 1000;

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
  return typeof value === "string" ? sanitizeString(value, max) : "";
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ success: false, reason: "Gövde geçersiz." }, { status: 400 });
  }

  const rawLocale = readText(body, "locale", 10);
  const locale = (routing.locales as readonly string[]).includes(rawLocale)
    ? rawLocale
    : routing.defaultLocale;

  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(getAuthToken(request) ?? "");
  if (userError || !user?.email) {
    return NextResponse.json({ success: false, reason: "Oturum gerekli." }, { status: 401 });
  }
  if (user.email_confirmed_at) {
    return NextResponse.json({ success: false, reason: "Bu hesap için hoş geldin maili gönderilmiş." }, { status: 409 });
  }

  // Gövdedeki e-posta hiç kullanılmaz: alıcı her zaman token sahibinin kayıtlı e-postasıdır.
  const receiverEmail = user.email.trim().toLowerCase();
  if (!validateEmail(receiverEmail)) {
    return NextResponse.json({ success: false, reason: "Hesap e-postası geçersiz." }, { status: 400 });
  }

  const ip = getClientIp(request) || "unknown";
  if (!checkRateLimit(ip, { name: "welcome-ip", windowMs: IP_WINDOW_MS, max: 10 })) {
    return NextResponse.json({ success: false, reason: "Çok fazla istek." }, { status: 429 });
  }
  if (!checkRateLimit(receiverEmail, { name: "welcome-email", windowMs: DAY_MS, max: 1 })) {
    return NextResponse.json({ success: false, reason: "Bu hesap için bugün gönderim tamamlandı." }, { status: 429 });
  }

  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME;
  if (!brevoApiKey || !fromEmail || !fromName) {
    console.error("Brevo ENV eksik: BREVO_API_KEY/BREVO_FROM_EMAIL/BREVO_FROM_NAME tanımsız.");
    return NextResponse.json({ success: false, reason: "Brevo yapılandırması eksik." }, { status: 500 });
  }

  const firstName = readText(body, "firstName", 60);
  const lastName = readText(body, "lastName", 60);
  const displayName = firstName && lastName ? `${firstName} ${lastName}` : receiverEmail;

  let welcomeEmail: MessageTree = {};
  try {
    const messages = await loadMessagesWithEnFallback(locale);
    if (messages.welcomeEmail && typeof messages.welcomeEmail === "object" && !Array.isArray(messages.welcomeEmail)) {
      welcomeEmail = messages.welcomeEmail;
    }
  } catch (_) {
    // Çeviri yüklenemezse aşağıdaki varsayılan metinler kullanılır.
  }

  const text = (key: string, fallback: string): string => {
    const value = welcomeEmail[key];
    return typeof value === "string" && value.trim() ? value : fallback;
  };

  const greeting = text("greeting", "Hello {name},").replace(/\{name\}/g, escapeHtml(displayName));

  const htmlContent = [
    `<p>${greeting}</p>`,
    `<p>${escapeHtml(text("intro", ""))}</p>`,
    `<p>${escapeHtml(text("accountCreated", ""))}</p>`,
    `<p>${escapeHtml(text("closing", ""))}<br><strong>${escapeHtml(text("team", "KurdEvents Team"))}</strong></p>`,
  ].join("");

  try {
    const brevo = createBrevoClient(brevoApiKey);
    await brevo.transactionalEmails.sendTransacEmail({
      to: [{ email: receiverEmail, name: displayName }],
      sender: { name: fromName, email: fromEmail },
      subject: text("subject", "Welcome to KurdEvents!"),
      htmlContent,
    });
  } catch (error) {
    console.error("welcome mail send error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, reason: "Hoş geldin maili gönderilemedi." }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
