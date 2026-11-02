import { createBrevoClient } from "@/lib/brevo-client";
import { eventReportFileName, type EventReportData } from "@/lib/event-report";

type MailResult = { sent: boolean; reason?: string };

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function euro(value: number, currency: string): string {
  const symbol = currency === "TL" ? "TRY" : currency || "EUR";
  return `${Number(value ?? 0).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency === "EUR" || !currency ? "€" : symbol}`;
}

function shortDate(value: string | null | undefined): string {
  const raw = String(value || "").slice(0, 10);
  const [year, month, day] = raw.split("-");
  if (!year || !month || !day) return "–";
  return `${day}.${month}.${year}`;
}

function buildHtml(data: EventReportData): string {
  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">${esc(label)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;color:#0f172a;${strong ? "font-weight:700;" : ""}">${esc(value)}</td>
    </tr>`;

  const commission = data.commission
    ? row(`Plattformprovision (${data.commission.rate.toLocaleString("de-DE")} %)`, euro(data.commission.gross, data.event.currency)) +
      row("USt 19 % auf Provision", euro(data.commission.tax, data.event.currency)) +
      row("Auszahlung an den Veranstalter", euro(data.commission.payout, data.event.currency), true)
    : "";

  return `
    <div style="font-family:Arial,sans-serif;background:#eef2f7;padding:24px;">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:1px;color:#DC0B2C;font-weight:700;">KURDEVENTS</p>
        <h2 style="margin:0 0 6px;color:#0f172a;font-size:19px;">Veranstaltungsabrechnung</h2>
        <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">
          Guten Tag,<br />
          anbei erhalten Sie die Abrechnung für <strong>${esc(data.event.title)}</strong>
          am ${esc(shortDate(data.event.date))}${data.event.venue ? ` in ${esc(data.event.venue)}` : ""}.
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;">
          ${row("Verkaufte Tickets", String(data.sales.tickets))}
          ${row("Bruttoverkauf", euro(data.sales.gross, data.event.currency), true)}
          ${row(`USt ${data.event.vatRate.toLocaleString("de-DE")} % (enthalten)`, euro(data.sales.tax, data.event.currency))}
          ${row("Nettoverkauf", euro(data.sales.net, data.event.currency))}
          ${commission}
          ${row("Ausgestellte Rechnungen", String(data.invoices.issued))}
        </table>
        <p style="margin:16px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
          Die vollständige Aufstellung (Ticketarten, Kanäle, Rechnungsnummern) finden Sie im angehängten PDF.
          Diese Abrechnung ist eine Zusammenfassung für die Buchhaltung und kein Rechnungsdokument an Käufer.
        </p>
      </div>
    </div>
  `;
}

/**
 * Abrechnung mailı: PDF ek olarak gider, mail hiçbir zaman otomatik tetiklenmez.
 * Production dışında Brevo kapısı kapalıdır (OutboundMailDisabled) → {sent:false}.
 */
export async function sendEventReportEmail(input: {
  to: string;
  data: EventReportData;
  pdf: Uint8Array;
}): Promise<MailResult> {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  const fromName = process.env.BREVO_FROM_NAME;

  if (!brevoApiKey || !fromEmail || !fromName) {
    return { sent: false, reason: "Brevo yapılandırması eksik." };
  }

  const subject = `Veranstaltungsabrechnung – ${input.data.event.title} (${shortDate(input.data.event.date)})`;

  try {
    const brevo = createBrevoClient(brevoApiKey);
    await brevo.transactionalEmails.sendTransacEmail({
      to: [{ email: input.to }],
      sender: { name: fromName, email: fromEmail },
      subject,
      htmlContent: buildHtml(input.data),
      attachment: [
        {
          content: Buffer.from(input.pdf).toString("base64"),
          name: eventReportFileName(input.data),
        },
      ],
    });
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: (error as Error)?.message };
  }
}
