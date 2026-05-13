/**
 * Salon planı bölüm/sıra etiketleri ile etkinlik bilet katalog adını eşler.
 * EventDetailClient ve purchase assignBestAvailableSeats ile uyumlu olmalı.
 */

export type TicketLike = {
  id: string;
  name?: string | null;
  price?: number | null;
  available?: number | null;
};

function dedupeRepeatedTail(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return name.trim();
  for (let k = 1; k <= Math.floor(tokens.length / 2); k++) {
    const tail = tokens.slice(-k).join(" ").toLowerCase();
    const before = tokens.slice(-2 * k, -k).join(" ").toLowerCase();
    if (tail && before && tail === before) {
      return tokens.slice(0, -k).join(" ").trim();
    }
  }
  return name.trim();
}

/**
 * Pazarlama / katalog metinleri: tekrarlayan blok ("Kategori 1 Kategori 1") sonra token‑kuyruk temizliği.
 */
export function cleanTicketMarketingName(raw: string): string {
  let s = (raw || "").trim();
  s = s.replace(/\b((?:Kategorie|Kategori)\s*\d+)\s+\1\b/gi, "$1");
  s = s.replace(/\b(Standart|Standard|VIP|Vip)\s+\1\b/gi, "$1");
  s = dedupeRepeatedTail(s);
  return s.trim();
}

export function shortenTicketDisplayName(name: string): string {
  const normalized = cleanTicketMarketingName(name);
  const dashIdx = normalized.lastIndexOf(" - ");
  if (dashIdx > 0) {
    const tail = normalized.slice(dashIdx + 3).trim();
    if (tail) return tail;
  }
  return normalized;
}

export function normalizeTicketMatchText(value: string): string {
  return cleanTicketMarketingName(value).trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildTicketLabelVariants(raw: string): string[] {
  const cleaned = cleanTicketMarketingName(raw || "").trim();
  if (!cleaned) return [];
  const out = new Set<string>();
  const short = shortenTicketDisplayName(cleaned);
  const dashIdx = cleaned.lastIndexOf(" - ");
  const dashTail = dashIdx > 0 ? cleaned.slice(dashIdx + 3).trim() : "";
  for (const part of [cleaned, short, dashTail]) {
    const n = normalizeTicketMatchText(part);
    if (n) out.add(n);
  }
  return Array.from(out);
}

/**
 * Salon tarafı etiketleri (ticket_type_label, bölüm adı vb.) verilen katalog bilet satırına uyuyor mu?
 * EventDetailClient içindeki findTicketByLabels ile aynı skor mantığı.
 */
export function findTicketByLabels(labels: string[], availableTickets: TicketLike[]): TicketLike | null {
  if (!labels.length || !availableTickets.length) return null;
  const normalizedLabels = Array.from(
    new Set(
      labels
        .flatMap((l) => buildTicketLabelVariants(l))
        .map((x) => normalizeTicketMatchText(x))
        .filter(Boolean)
    )
  );
  if (!normalizedLabels.length) return null;

  let best: { ticket: TicketLike; score: number } | null = null;
  for (const t of availableTickets) {
    const rawName = String(t.name || "").trim();
    if (!rawName) continue;
    const full = normalizeTicketMatchText(rawName);
    const short = normalizeTicketMatchText(shortenTicketDisplayName(rawName));
    let score: number | null = null;

    if (normalizedLabels.includes(full)) {
      score = 0;
    } else if (short && normalizedLabels.includes(short)) {
      score = 1;
    } else if (
      normalizedLabels.some((l) =>
        (short && (short.endsWith(` ${l}`) || l.endsWith(` ${short}`))) ||
        full.endsWith(` ${l}`) ||
        l.endsWith(` ${full}`)
      )
    ) {
      score = 2;
    } else if (normalizedLabels.some((l) => l.length >= 4 && (full.includes(l) || (short && short.includes(l))))) {
      score = 3;
    }

    if (score === null) continue;
    if (!best || score < best.score) best = { ticket: t, score };
  }
  return best?.ticket ?? null;
}

/** Tek katalog adı için plan etiketleriyle eşleşme (purchase tarafı). */
export function planLabelsMatchTicketCatalogName(planLabels: string[], catalogTicketName: string): boolean {
  const probe: TicketLike = { id: "__probe__", name: catalogTicketName };
  const hit = findTicketByLabels(planLabels, [probe]);
  return hit?.id === "__probe__";
}
