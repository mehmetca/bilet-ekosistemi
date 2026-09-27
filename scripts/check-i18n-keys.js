#!/usr/bin/env node
/**
 * messages/*.json içindeki anahtarları karşılaştırır.
 * Eksik veya fazla anahtarları raporlar (tr referans alınır).
 *
 * Aşağıdakiler bilinçli olarak karşılaştırmaya dahil edilmez:
 *  - adminPanel: yönetim paneli yalnızca Türkçe (admin dışında görülmez)
 *  - ticketPrint.printBannerTitle / barcodeLoadingPlaceholder: e-bilet kartı
 *    sabit metinleri her zaman Almanca (TicketPrint.tsx içinde de.json'dan okunur)
 *
 * Kullanım: node scripts/check-i18n-keys.js
 */
const fs = require("fs");
const path = require("path");

const messagesDir = path.join(__dirname, "..", "messages");
const locales = fs
  .readdirSync(messagesDir)
  .filter((file) => file.endsWith(".json"))
  .map((file) => path.basename(file, ".json"))
  .sort();

/** Karşılaştırmaya hiç dahil edilmeyen üst seviye namespace'ler. */
const IGNORED_NAMESPACES = new Set(["adminPanel"]);
/** Tekil anahtar bazında atlananlar (belli bir dile özel sabitler). */
const IGNORED_KEYS = new Set([
  "ticketPrint.printBannerTitle",
  "ticketPrint.barcodeLoadingPlaceholder",
]);

function getAllKeys(obj, prefix = "") {
  const keys = new Set();
  for (const key of Object.keys(obj)) {
    if (prefix === "" && IGNORED_NAMESPACES.has(key)) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      getAllKeys(value, fullKey).forEach((k) => keys.add(k));
    } else {
      keys.add(fullKey);
    }
  }
  return keys;
}

function withoutIgnored(keys) {
  const out = new Set(keys);
  for (const k of IGNORED_KEYS) out.delete(k);
  return out;
}

function loadJson(locale) {
  const file = path.join(messagesDir, `${locale}.json`);
  if (!fs.existsSync(file)) {
    console.error(`Dosya bulunamadı: ${file}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error(`${locale}.json parse hatası:`, e.message);
    return null;
  }
}

const refLocale = "tr";
const refData = loadJson(refLocale);
if (!refData) process.exit(1);

const refKeys = withoutIgnored(getAllKeys(refData));
console.log(`\nReferans: ${refLocale}.json → ${refKeys.size} anahtar (karşılaştırılan).\n`);

let hasError = false;
for (const locale of locales) {
  if (locale === refLocale) continue;
  const data = loadJson(locale);
  if (!data) {
    hasError = true;
    continue;
  }
  const keys = withoutIgnored(getAllKeys(data));
  const missing = [...refKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !refKeys.has(k));
  if (missing.length > 0) {
    hasError = true;
    console.log(`${locale}.json – Eksik anahtarlar (${missing.length}):`);
    missing.sort().forEach((k) => console.log(`  - ${k}`));
    console.log("");
  }
  if (extra.length > 0) {
    console.log(`${locale}.json – Referansta olmayan anahtarlar (${extra.length}):`);
    extra.sort().forEach((k) => console.log(`  + ${k}`));
    console.log("");
  }
  if (missing.length === 0 && extra.length === 0) {
    console.log(`${locale}.json – Referans ile uyumlu.\n`);
  }
}

if (hasError) {
  process.exit(1);
}
console.log("Tüm diller referans (tr) ile uyumlu.");
