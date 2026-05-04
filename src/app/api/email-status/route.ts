import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

/**
 * Bilet e-postası yapılandırmasını kontrol eder.
 * Sadece env var'ların tanımlı olup olmadığını döner (değerleri göstermez).
 * Yönetim panelinden veya deploy sonrası doğrulama için kullanılabilir.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const hasResendKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const hasFromAddress = Boolean(process.env.TICKET_EMAIL_FROM?.trim());
  const ready = hasResendKey && hasFromAddress;

  return NextResponse.json({
    ready,
    checks: {
      RESEND_API_KEY: hasResendKey ? "tanımlı" : "eksik",
      TICKET_EMAIL_FROM: hasFromAddress ? "tanımlı" : "eksik",
    },
    message: ready
      ? "E-posta yapılandırması hazır."
      : "E-posta gönderilemez: " +
        [
          !hasResendKey && "RESEND_API_KEY eksik",
          !hasFromAddress && "TICKET_EMAIL_FROM eksik",
        ]
          .filter(Boolean)
          .join(", "),
  });
}
