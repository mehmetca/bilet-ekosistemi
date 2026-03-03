const EXTERNAL_TICKET_URL_START = "<!--EVENT_EXTERNAL_TICKET_URL_START-->";
const EXTERNAL_TICKET_URL_END = "<!--EVENT_EXTERNAL_TICKET_URL_END-->";

export type EventMeta = {
  content: string;
  externalTicketUrl: string;
};

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

  return { content: working.trim(), externalTicketUrl };
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

