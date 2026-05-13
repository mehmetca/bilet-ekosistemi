/**
 * Preis-/Kategorie-Liste: einzeilige Beschriftung mit Wortstellung
 * VIP: „Vip Bilet Parket 100,00 €“ · Standard: „Parket Standart Bilet 80,00 €“
 * (ohne Mittelpunkt; Zahl hinten wie im deutschen Ticketjargon üblich).
 */

import type { EventCurrency, Ticket } from "@/types/database";
import { CURRENCY_SYMBOLS } from "@/types/database";
import { cleanTicketMarketingName } from "@/lib/ticket-seating-match";

const DEFAULT_CURRENCY: EventCurrency = "EUR";

function localeForAmount(currency: EventCurrency): string {
  switch (currency) {
    case "EUR":
      return "de-DE";
    case "TL":
      return "tr-TR";
    case "USD":
      return "en-US";
    default:
      return "de-DE";
  }
}

/** Nur für diese Listenzeile: „100,00 €“ / „150,00 ₺“ (Symbol hinten). */
function formatShelfTrailingPrice(amount: number, currency?: EventCurrency | null): string {
  const curr =
    currency && CURRENCY_SYMBOLS[currency as EventCurrency]
      ? (currency as EventCurrency)
      : DEFAULT_CURRENCY;
  const n = Number(amount).toLocaleString(localeForAmount(curr), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n} ${CURRENCY_SYMBOLS[curr]}`.trim();
}

function effectiveTierIsVip(ticket: Pick<Ticket, "type" | "ticket_type" | "name">): boolean {
  const t = String(ticket.type || ticket.ticket_type || "").toLowerCase().trim();
  if (t === "vip") return true;
  return /\bvip\b/i.test(ticket.name || "");
}

/** „Parket – Vip Bilet“ → Zone + Sorte. */
export function ticketZoneAndTierLabel(name: string | null | undefined): { zone: string; tierLabel: string } {
  const cleaned = cleanTicketMarketingName((name || "").trim());
  const dashIdx = cleaned.lastIndexOf(" - ");
  if (dashIdx > 0) {
    return {
      zone: cleaned.slice(0, dashIdx).trim(),
      tierLabel: cleanTicketMarketingName(cleaned.slice(dashIdx + 3).trim()),
    };
  }
  return { zone: "", tierLabel: cleaned };
}

function kategoriOrdinal(name: string): number {
  const m = name.match(/\b(?:Kategorie|Kategori)\s*(\d+)/i);
  if (!m) return 9999;
  const n = parseInt(m[1]!, 10);
  return Number.isFinite(n) ? n : 9999;
}

function nonVipShelfRank(name: string): number {
  const lower = name.toLowerCase();
  if (/\bkategorie\s*\d+|\bkategori\s*\d+/i.test(name)) return 2;
  if (/\bstandart\b|\bstandard\b|\bnormal\b/i.test(lower)) return 1;
  return 50;
}

/**
 * Für die Tab „Preiskategorie“: sort_order vom Wizard, dann VIP, dann Zone, dann Kategorie/Standart, dann höherer Preis.
 */
export function compareTicketsPriceCategoryShelf(a: Ticket, b: Ticket): number {
  const ao = typeof a.sort_order === "number" ? a.sort_order : 9999;
  const bo = typeof b.sort_order === "number" ? b.sort_order : 9999;
  if (ao !== bo) return ao - bo;

  const vipA = effectiveTierIsVip(a) ? 0 : 1;
  const vipB = effectiveTierIsVip(b) ? 0 : 1;
  if (vipA !== vipB) return vipA - vipB;

  const za = ticketZoneAndTierLabel(a.name).zone;
  const zb = ticketZoneAndTierLabel(b.name).zone;
  if (za !== zb) return za.localeCompare(zb, "tr", { sensitivity: "base" });

  const ra = nonVipShelfRank(a.name);
  const rb = nonVipShelfRank(b.name);
  if (ra !== rb) return ra - rb;

  const ka = kategoriOrdinal(a.name);
  const kb = kategoriOrdinal(b.name);
  if (ka !== kb) return ka - kb;

  return Number(b.price || 0) - Number(a.price || 0);
}

function normalizeVipWordCasing(s: string): string {
  return s.replace(/\bvip\b/gi, "Vip");
}

/**
 * „Kategorie 1“ wirkt oft laienhaft → branchenüblichere Begriffe je UI-Sprache.
 * (Zuordnung der Nummer kommt weiter aus dem Wizard.)
 */
export function professionalizeTierDisplay(tierRaw: string, localeHint?: string): string {
  let s = cleanTicketMarketingName(tierRaw).trim();
  s = normalizeVipWordCasing(s);

  const root = ((localeHint || "tr").split("-")[0] || "tr").toLowerCase();

  if (root === "de") {
    s = s.replace(/\bKategorie\s*(\d+)\b/gi, "Preisgruppe $1");
    s = s.replace(/\bKategorien\s*(\d+)\b/gi, "Preisgruppe $1");
    s = s.replace(/\bKategori\s*(\d+)\b/gi, "Preisgruppe $1");
    return s;
  }
  if (root === "tr") {
    s = s.replace(/\bKategorie\s*(\d+)\b/gi, "$1. fiyat grubu");
    s = s.replace(/\bKategori\s*(\d+)\b/gi, "$1. fiyat grubu");
    return s;
  }
  if (root === "en") {
    s = s.replace(/\bKategorie\s*(\d+)\b/gi, "Price tier $1");
    s = s.replace(/\bKategori\s*(\d+)\b/gi, "Price tier $1");
    return s;
  }
  s = s.replace(/\b(?:Kategorie|Kategori)\s*(\d+)\b/gi, "Price tier $1");
  return s;
}

/**
 * Eine Zeile für Regal & Warenkorb:
 * - VIP: **Vip Bilet Parket 100,00 €** (Sorte · Zone · Preis)
 * - sonst: **Parket Standart Bilet 80,00 €** (Zone · Sorte · Preis)
 */
export function formatPriceCategoryShelfLabel(
  ticket: Pick<Ticket, "name" | "type" | "ticket_type" | "price">,
  currency?: EventCurrency | null,
  localeHint?: string
): string {
  const { zone, tierLabel } = ticketZoneAndTierLabel(ticket.name);
  const rawTier = tierLabel || cleanTicketMarketingName(ticket.name || "");
  const tier = professionalizeTierDisplay(rawTier, localeHint);
  const z = zone ? cleanTicketMarketingName(zone) : "";
  const priceTxt = formatShelfTrailingPrice(Number(ticket.price || 0), currency);

  const vip = effectiveTierIsVip(ticket);
  const body = vip ? (z ? `${tier} ${z}` : tier) : z ? `${z} ${tier}` : tier;
  return `${body} ${priceTxt}`.replace(/\s+/g, " ").trim();
}
