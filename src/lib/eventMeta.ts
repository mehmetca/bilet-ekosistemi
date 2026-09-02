const EXTERNAL_TICKET_URL_START = "<!--EVENT_EXTERNAL_TICKET_URL_START-->";
const EXTERNAL_TICKET_URL_END = "<!--EVENT_EXTERNAL_TICKET_URL_END-->";

export type EventMeta = {
  content: string;
  externalTicketUrl: string;
};

/**
 * Yapıştırılan metinlerden gelen "kırılmaz boşlukları" (NBSP vb.) normal
 * boşluğa çevirir; hem gerçek karakter hem de HTML entity ("&nbsp;") hali
 * yakalanır. Aksi halde tarayıcı, kelimeler arasını tek bir bölünmez sözcük
 * sanıp satır sonunda kelimeyi ortadan kesebiliyor.
 */
export function normalizeDescriptionHtml(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/[\u00a0\u202f\u2007]/g, " ") // gerçek kırılmaz boşluk karakterleri
    .replace(/&nbsp;/gi, " ") // HTML entity hali
    .replace(/&#160;/gi, " ")
    .replace(/&#xa0;/gi, " ");
}

/**
 * HTML açıklamayı kart önizlemelerinde gösterilebilecek düz metne çevirir
 * (etiketleri ayıklar, entity'leri çözer, boşlukları sadeleştirir).
 */
export function eventDescriptionToPlainText(html?: string | null): string {
  if (!html) return "";
  return normalizeDescriptionHtml(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseEventDescription(raw?: string | null): EventMeta {
  if (!raw) return { content: "", externalTicketUrl: "" };

  let working = raw;
  let externalTicketUrl = "";

  const startIdx = working.indexOf(EXTERNAL_TICKET_URL_START);
  const endIdx = working.indexOf(EXTERNAL_TICKET_URL_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    externalTicketUrl = working
      .slice(startIdx + EXTERNAL_TICKET_URL_START.length, endIdx)
      .trim();

    working = `${working.slice(0, startIdx)}${working.slice(
      endIdx + EXTERNAL_TICKET_URL_END.length
    )}`.trim();
  }

  return { content: normalizeDescriptionHtml(working.trim()), externalTicketUrl };
}

export function buildEventDescription(content: string, externalTicketUrl?: string): string {
  const cleanedContent = (content || "").trim();
  const url = (externalTicketUrl || "").trim();
  if (!url) return cleanedContent;

  return [EXTERNAL_TICKET_URL_START, url, EXTERNAL_TICKET_URL_END, "", cleanedContent]
    .filter((part) => part !== undefined)
    .join("\n")
    .trim();
}

