/**
 * Preis-Kategorie Liste (Ticketauswahl ohne Sitzwahl): Reihenfolge und eine Zeilenbeschriftung
 * („VIP · Parket · 100 €“ / „Parket · Kategorie 1 · 80 €“).
 */

import type { EventCurrency, Ticket } from "@/types/database";
import { formatPrice } from "@/lib/formatPrice";
import { cleanTicketMarketingName } from "@/lib/ticket-seating-match";

const DOT = "\u00b7";

function effectiveTierIsVip(ticket: Pick<Ticket, "type" | "ticket_type" | "name">): boolean {
  const t = String(ticket.type || ticket.ticket_type || "").toLowerCase().trim();
  if (t === "vip") return true;
  return /\bvip\b/i.test(ticket.name || "");
}

/** „Parket – VIP Bilet“ → zone + Stufennamen ohne Doppelungen. */
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

/**
 * Eine konsistent formatierte Shelf-Zeile (DE/ TR / EN ohne Zwang „Euro“, Preis wird formatPrice geliefert).
 * VIP: Stufe · Zone · Preis · … sonst Zone · Stufe · Preis …
 */
export function formatPriceCategoryShelfLabel(
  ticket: Pick<Ticket, "name" | "type" | "ticket_type" | "price">,
  currency?: EventCurrency | null
): string {
  const { zone, tierLabel } = ticketZoneAndTierLabel(ticket.name);
  const tier = tierLabel || cleanTicketMarketingName(ticket.name || "");
  const priceTxt = formatPrice(Number(ticket.price || 0), currency ?? undefined);

  const vip = effectiveTierIsVip(ticket);
  let core = "";
  if (vip && zone) {
    core = `${tier} ${DOT} ${zone}`;
  } else if (!vip && zone) {
    core = `${zone} ${DOT} ${tier}`;
  } else {
    core = tier;
  }
  return `${core} ${DOT} ${priceTxt}`.replace(/\s+/g, " ").trim();
}
