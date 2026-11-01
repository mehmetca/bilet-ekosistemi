import type { InvoiceRow } from "@/lib/invoice";

/**
 * EN16931 Cross Industry Invoice (CII) XML üretimi — ZUGFeRD/Factur-X profili.
 * Bağımlılık yok: belge tek yerden, fatura satırının değişmez anlık görüntüsünden üretilir.
 *
 * XRechnung'un kabul ettiği iki sözdizimi de CII tabanlıdır (UN/CEFACT D16B/D21B);
 * Factur-X gömülü sürümü için PDF/A-3 + XMP gerekir — o ayrı adım, bkz. invoice-pdf.ts.
 */

const NS_RSM = "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100";
const NS_RAM = "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100";
const NS_UDT = "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100";

const GUIDELINE = "urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:en16931";

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** ISO 8601 → EN16931 YYYYMMDD (saat gerekmez, tarih yeterlidir). */
function ymd(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}${m}${d}`;
}

function money(value: number): string {
  return Number(value ?? 0).toFixed(2);
}

/** UNTDID 4451: 58 = Kart, 30 = Nakit, 48 = Havale. */
function paymentMeansCode(method?: string | null): string {
  const text = (method || "").toLowerCase();
  if (text.includes("bar")) return "30";
  if (text.includes("kart") || text.includes("card") || text.includes("stripe") || text.includes("kredit")) {
    return "58";
  }
  return "48";
}

function partyBlock(
  tag: "SellerTradeParty" | "BuyerTradeParty",
  inv: InvoiceRow,
  opts: { party: "seller" | "buyer" }
): string {
  const p = opts.party === "seller" ? inv.seller_snapshot : inv.buyer_snapshot;
  const name = esc(p.name || (opts.party === "seller" ? "Veranstalter" : "Gast"));
  const street = esc(p.street || p.address || "");
  const cityLine = esc(String(p.city || "").trim());
  const postcode = esc(
    String(p.postcode || "").trim() || (p.city || "").match(/\b(\d{5})\b/)?.[1] || ""
  );
  const country = esc(String(p.country || "DE").trim().toUpperCase() || "DE");
  const taxReg =
    opts.party === "seller"
      ? [
          p.vat_id
            ? `<ram:SpecifiedTradePartyTaxRegistration><ram:ID schemeID="VAT">${esc(p.vat_id)}</ram:ID></ram:SpecifiedTradePartyTaxRegistration>`
            : "",
          p.tax_id
            ? `<ram:SpecifiedTradePartyTaxRegistration><ram:ID schemeID="FC">${esc(p.tax_id)}</ram:ID></ram:SpecifiedTradePartyTaxRegistration>`
            : "",
        ].join("")
      : "";

  return (
    `<ram:${tag}>` +
    `<ram:Name>${name}</ram:Name>` +
    (p.email ? `<ram:DefinedTradeContact><ram:ElectronicMailURI>${esc(p.email)}</ram:ElectronicMailURI></ram:DefinedTradeContact>` : "") +
    `<ram:PostalTradeAddress>` +
    (postcode ? `<ram:PostcodeCode>${esc(postcode)}</ram:PostcodeCode>` : "") +
    (street ? `<ram:LineOne>${street}</ram:LineOne>` : "") +
    (cityLine ? `<ram:CityName>${cityLine}</ram:CityName>` : "") +
    `<ram:CountryID>${country}</ram:CountryID>` +
    `</ram:PostalTradeAddress>` +
    taxReg +
    `</ram:${tag}>`
  );
}

function lineBlock(inv: InvoiceRow): string {
  const line = inv.line_items[0] ?? {
    text: "Einlasskarte",
    qty: 1,
    unit_net: inv.net_total,
    line_net: inv.net_total,
    line_tax: inv.tax_total,
    line_gross: inv.gross_total,
    tax_rate: inv.tax_rate,
    tax_category: inv.tax_category,
  };
  const category = line.tax_category === "E" ? "E" : "S";
  const rate = category === "E" ? "0.00" : money(line.tax_rate);
  const qty = esc(String(line.qty || 1));

  // Sadece NetPrice ürünü yazılır (BT-146): EN16931'de brüt fiyat (BT-148) ancak bir
  // fiyat indirimi varsa zorunludur; indirim yokluğunda fazladan blok validasyon uyarısı üretir.
  return (
    "<ram:IncludedSupplyChainTradeLineItem>" +
    "<ram:AssociatedDocumentLineDocument><ram:LineID>1</ram:LineID></ram:AssociatedDocumentLineDocument>" +
    "<ram:SpecifiedTradeProduct>" +
    `<ram:Name>${esc(line.text)}</ram:Name>` +
    "<ram:Description>Einlasskarte</ram:Description>" +
    "</ram:SpecifiedTradeProduct>" +
    "<ram:SpecifiedLineTradeAgreement>" +
    "<ram:NetPriceProductTradePrice>" +
    `<ram:ChargeAmount>${money(line.unit_net)}</ram:ChargeAmount>` +
    `<ram:BasisQuantity unitCode="H87">${qty}</ram:BasisQuantity>` +
    "</ram:NetPriceProductTradePrice>" +
    "</ram:SpecifiedLineTradeAgreement>" +
    "<ram:SpecifiedLineTradeDelivery>" +
    `<ram:BilledQuantity unitCode="H87">${qty}</ram:BilledQuantity>` +
    "</ram:SpecifiedLineTradeDelivery>" +
    "<ram:SpecifiedLineTradeSettlement>" +
    `<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${category}</ram:CategoryCode><ram:RateApplicablePercent>${rate}</ram:RateApplicablePercent></ram:ApplicableTradeTax>` +
    "<ram:SpecifiedTradeSettlementLineMonetarySummation>" +
    `<ram:LineTotalAmount>${money(line.line_net)}</ram:LineTotalAmount>` +
    "</ram:SpecifiedTradeSettlementLineMonetarySummation>" +
    "</ram:SpecifiedLineTradeSettlement>" +
    "</ram:IncludedSupplyChainTradeLineItem>"
  );
}

export function buildXRechnungXml(inv: InvoiceRow): string {
  const headerTax =
    inv.tax_category === "E"
      ? "<ram:ApplicableTradeTax>" +
        `<ram:CalculatedAmount>${money(inv.tax_total)}</ram:CalculatedAmount>` +
        "<ram:TypeCode>VAT</ram:TypeCode>" +
        '<ram:ExemptionReason>Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</ram:ExemptionReason>' +
        `<ram:BasisAmount>${money(inv.net_total)}</ram:BasisAmount>` +
        "<ram:CategoryCode>E</ram:CategoryCode>" +
        "<ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>" +
        "</ram:ApplicableTradeTax>"
      : "<ram:ApplicableTradeTax>" +
        `<ram:CalculatedAmount>${money(inv.tax_total)}</ram:CalculatedAmount>` +
        "<ram:TypeCode>VAT</ram:TypeCode>" +
        `<ram:BasisAmount>${money(inv.net_total)}</ram:BasisAmount>` +
        "<ram:CategoryCode>S</ram:CategoryCode>" +
        `<ram:RateApplicablePercent>${money(inv.tax_rate)}</ram:RateApplicablePercent>` +
        "</ram:ApplicableTradeTax>";

  // 380 = Rechnung, 381 = Storno-Rechnung (EN16931 BT-3 UNCL421 kodları).
  const typeCode = inv.status === "cancelled" ? "381" : "380";
  const issueDate = ymd(inv.issued_at);

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<rsm:CrossIndustryInvoice xmlns:rsm="${NS_RSM}" xmlns:ram="${NS_RAM}" xmlns:udt="${NS_UDT}">` +
    "<rsm:ExchangedDocumentContext>" +
    `<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${GUIDELINE}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter>` +
    "</rsm:ExchangedDocumentContext>" +
    "<rsm:ExchangedDocument>" +
    `<ram:ID>${esc(inv.invoice_number)}</ram:ID>` +
    "<ram:Name>RECHNUNG</ram:Name>" +
    `<ram:TypeCode>${typeCode}</ram:TypeCode>` +
    `<ram:IssueDateTime><udt:DateTimeString format="102">${issueDate}</udt:DateTimeString></ram:IssueDateTime>` +
    (inv.storno_reason
      ? `<ram:IncludedNote><ram:Content>${esc(inv.storno_reason)}</ram:Content></ram:IncludedNote>`
      : "") +
    "</rsm:ExchangedDocument>" +
    "<rsm:SupplyChainTradeTransaction>" +
    "<ram:ApplicableHeaderTradeAgreement>" +
    "<ram:BuyerReference>KURDEVENTS</ram:BuyerReference>" +
    partyBlock("SellerTradeParty", inv, { party: "seller" }) +
    partyBlock("BuyerTradeParty", inv, { party: "buyer" }) +
    `<ram:AdditionalReferencedDocument><ram:IssuerAssignedID>${esc(inv.order_id)}</ram:IssuerAssignedID><ram:TypeCode>235</ram:TypeCode><ram:Name>BESTELLNUMMER</ram:Name></ram:AdditionalReferencedDocument>` +
    "</ram:ApplicableHeaderTradeAgreement>" +
    "<ram:ApplicableHeaderTradeDelivery>" +
    `<ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${issueDate}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent>` +
    "</ram:ApplicableHeaderTradeDelivery>" +
    "<ram:ApplicableHeaderTradeSettlement>" +
    `<ram:PaymentReference>${esc(inv.invoice_number)}</ram:PaymentReference>` +
    `<ram:InvoiceCurrencyCode>${esc(inv.currency || "EUR")}</ram:InvoiceCurrencyCode>` +
    "<ram:PayeeTradeParty>" +
    `<ram:Name>${esc(inv.seller_snapshot.name || "Veranstalter")}</ram:Name>` +
    "</ram:PayeeTradeParty>" +
    `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>${paymentMeansCode(inv.payment_method)}</ram:TypeCode><ram:Information>${esc(inv.payment_method || "Kreditkarte / Stripe")}</ram:Information></ram:SpecifiedTradeSettlementPaymentMeans>` +
    headerTax +
    "<ram:SpecifiedTradePaymentTerms>" +
    "<ram:Description>Bezahlt / ausgeglichen bei Erhalt der Leistung.</ram:Description>" +
    `<ram:DueDateDateTime><udt:DateTimeString format="102">${issueDate}</udt:DateTimeString></ram:DueDateDateTime>` +
    "</ram:SpecifiedTradePaymentTerms>" +
    "<ram:SpecifiedTradeSettlementHeaderMonetarySummation>" +
    `<ram:LineTotalAmount>${money(inv.net_total)}</ram:LineTotalAmount>` +
    "<ram:ChargeTotalAmount>0.00</ram:ChargeTotalAmount>" +
    "<ram:AllowanceTotalAmount>0.00</ram:AllowanceTotalAmount>" +
    `<ram:TaxBasisTotalAmount>${money(inv.net_total)}</ram:TaxBasisTotalAmount>` +
    `<ram:TaxTotalAmount currencyID="${esc(inv.currency || "EUR")}">${money(inv.tax_total)}</ram:TaxTotalAmount>` +
    "<ram:RoundingAmount>0.00</ram:RoundingAmount>" +
    `<ram:GrandTotalAmount>${money(inv.gross_total)}</ram:GrandTotalAmount>` +
    `<ram:TotalPrepaidAmount>${money(inv.gross_total)}</ram:TotalPrepaidAmount>` +
    "<ram:DuePayableAmount>0.00</ram:DuePayableAmount>" +
    "</ram:SpecifiedTradeSettlementHeaderMonetarySummation>" +
    "</ram:ApplicableHeaderTradeSettlement>" +
    lineBlock(inv) +
    "</rsm:SupplyChainTradeTransaction>" +
    "</rsm:CrossIndustryInvoice>"
  );
}
