#!/usr/bin/env node
/**
 * messages/*.json içindeki anahtarları karşılaştırır.
 * Eksik veya fazla anahtarları raporlar (tr referans alınır).
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

function getAllKeys(obj, prefix = "") {
  const keys = new Set();
  for (const key of Object.keys(obj)) {
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

const refKeys = getAllKeys(refData);
console.log(`\nReferans: ${refLocale}.json → ${refKeys.size} anahtar.\n`);

let hasError = false;
for (const locale of locales) {
  if (locale === refLocale) continue;
  const data = loadJson(locale);
  if (!data) {
    hasError = true;
    continue;
  }
  const keys = getAllKeys(data);
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
