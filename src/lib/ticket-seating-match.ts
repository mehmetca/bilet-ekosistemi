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

export function shortenTicketDisplayName(name: string): string {
  const cleaned = dedupeRepeatedTail(name);
  const dashIdx = cleaned.lastIndexOf(" - ");
  if (dashIdx > 0) {
    const tail = cleaned.slice(dashIdx + 3).trim();
    if (tail) return tail;
  }
  return cleaned;
}

export function normalizeTicketMatchText(value: string): string {
  return dedupeRepeatedTail(value).trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildTicketLabelVariants(raw: string): string[] {
  const cleaned = dedupeRepeatedTail(raw || "").trim();
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

function scoreTicketAgainstLabels(
  catalogName: string,
  normalizedLabels: string[]
): number | null {
  const full = normalizeTicketMatchText(catalogName);
  const short = normalizeTicketMatchText(shortenTicketDisplayName(catalogName));
  if (!full) return null;

  if (normalizedLabels.includes(full)) return 0;
  if (short && normalizedLabels.includes(short)) return 1;
  if (
    normalizedLabels.some(
      (l) =>
        (short && (short.endsWith(` ${l}`) || l.endsWith(` ${short}`))) ||
        full.endsWith(` ${l}`) ||
        l.endsWith(` ${full}`)
    )
  ) {
    return 2;
  }
  // Zayıf: plan etiketi katalog adının kelime-sınırlı parçası (örn. bölüm "Balkon Sol" ⊂ "Balkon Sol VIP")
  if (
    normalizedLabels.some((l) => {
      if (l.length < 4) return false;
      return (
        full === l ||
        full.startsWith(`${l} `) ||
        full.endsWith(` ${l}`) ||
        full.includes(` ${l} `) ||
        (!!short &&
          (short === l ||
            short.startsWith(`${l} `) ||
            short.endsWith(` ${l}`) ||
            short.includes(` ${l} `)))
      );
    })
  ) {
    return 3;
  }
  return null;
}

/**
 * Salon tarafı etiketleri → katalog bilet.
 * Eşit skorda daha uzun (spesifik) ad kazanır.
 * Skor 3 birden fazla adaya uyuyorsa belirsiz sayılır → null (yanlış VIP atamasını önler).
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

  type Scored = { ticket: TicketLike; score: number; nameLen: number };
  const scored: Scored[] = [];

  for (const t of availableTickets) {
    const rawName = String(t.name || "").trim();
    if (!rawName) continue;
    const score = scoreTicketAgainstLabels(rawName, normalizedLabels);
    if (score === null) continue;
    scored.push({
      ticket: t,
      score,
      nameLen: normalizeTicketMatchText(rawName).length,
    });
  }

  if (!scored.length) return null;
  scored.sort((a, b) => a.score - b.score || b.nameLen - a.nameLen);

  if (scored[0]!.score >= 3) {
    const top = scored.filter((s) => s.score === scored[0]!.score);
    if (top.length > 1) return null;
  }

  return scored[0]!.ticket;
}

/** Tek katalog adı için plan etiketleriyle eşleşme (purchase tarafı). */
export function planLabelsMatchTicketCatalogName(planLabels: string[], catalogTicketName: string): boolean {
  const probe: TicketLike = { id: "__probe__", name: catalogTicketName };
  const hit = findTicketByLabels(planLabels, [probe]);
  return hit?.id === "__probe__";
}

/** Client getTicketForRow ile aynı etiket yığını. */
export function buildPlanRowMatchLabels(input: {
  sectionName?: string | null;
  sectionTicketTypeLabel?: string | null;
  rowTicketTypeLabel?: string | null;
}): string[] {
  const sectionName = String(input.sectionName || "").trim();
  const sectionL = String(input.sectionTicketTypeLabel || "").trim();
  const rowL = String(input.rowTicketTypeLabel || "").trim();
  return [
    rowL,
    sectionL,
    sectionName,
    sectionName ? shortenTicketDisplayName(sectionName) : "",
    rowL && sectionName ? `${sectionName} ${rowL}` : "",
    rowL && sectionName ? `${sectionName} - ${rowL}` : "",
    rowL && sectionL ? `${sectionL} ${rowL}` : "",
    rowL && sectionL ? `${sectionL} - ${rowL}` : "",
  ].filter(Boolean);
}

/** Sıra için en uygun katalog bileti (tüm biletler arasında en iyi eşleşme). */
export function resolveTicketForPlanRow(
  input: {
    sectionName?: string | null;
    sectionTicketTypeLabel?: string | null;
    rowTicketTypeLabel?: string | null;
  },
  availableTickets: TicketLike[]
): TicketLike | null {
  return findTicketByLabels(buildPlanRowMatchLabels(input), availableTickets);
}
