/**
 * theaterduisburg-seat-display-labels.json (1068, şema sırası) →
 * src/lib/seating-plans/theaterduisburg-svg-section-labels.generated.ts
 *
 * Bölüm uzunlukları theaterduisburg-svg-coords.generated.ts ile aynı olmalı.
 * Çalıştır: node scripts/build-duisburg-svg-section-labels.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const LABELS_JSON = path.join(ROOT, "public/seatplans/theaterduisburg-seat-display-labels.json");
const COORDS_FILE = path.join(ROOT, "src/lib/seating-plans/theaterduisburg-svg-coords.generated.ts");
const OUT = path.join(ROOT, "src/lib/seating-plans/theaterduisburg-svg-section-labels.generated.ts");

/** Coords dosyasındaki bölüm anahtar sırası (build-duisburg-svg-seat-coords.js ile senkron kalır) */
function extractSectionKeysFromCoordsTs(txt) {
  const marker = "THEATER_DUISBURG_SVG_COORDS_BY_SECTION";
  const mi = txt.indexOf(marker);
  if (mi < 0) throw new Error("coords: THEATER_DUISBURG_SVG_COORDS_BY_SECTION bulunamadı");
  const brace = txt.indexOf("{", mi);
  const end = txt.indexOf("\n};", brace);
  if (brace < 0 || end < 0) throw new Error("coords: blok parse edilemedi");
  const block = txt.slice(brace, end + 1);
  const keys = [];
  const re = /^\s*"([^"]+)"\s*:\s*\[/gm;
  let m;
  while ((m = re.exec(block))) {
    keys.push(m[1]);
  }
  if (!keys.length) throw new Error("coords: hiç bölüm anahtarı çıkmadı");
  return keys;
}

function countCoordsInGeneratedTs(txt, key) {
  const needle = `"${key}":`;
  const start = txt.indexOf(needle);
  if (start < 0) throw new Error(`coords: missing ${key}`);
  const sub = txt.slice(start);
  const open = sub.indexOf("[");
  const close = sub.indexOf("],");
  if (open < 0 || close < 0 || close <= open) throw new Error(`coords: bad array for ${key}`);
  const body = sub.slice(open + 1, close);
  return (body.match(/\{\s*nx:/g) || []).length;
}

function main() {
  const labels = JSON.parse(fs.readFileSync(LABELS_JSON, "utf8"));
  if (!Array.isArray(labels)) throw new Error("labels JSON must be array");
  const coordsTxt = fs.readFileSync(COORDS_FILE, "utf8");
  const sectionOrder = extractSectionKeysFromCoordsTs(coordsTxt);

  let offset = 0;
  const record = {};

  for (const key of sectionOrder) {
    const n = countCoordsInGeneratedTs(coordsTxt, key);
    const slice = labels.slice(offset, offset + n);
    if (slice.length !== n) {
      throw new Error(
        `${key}: need ${n} labels at offset ${offset}, have ${slice.length} (total labels ${labels.length})`
      );
    }
    offset += n;
    record[key] = slice;
  }

  const used = offset;
  if (used > labels.length) throw new Error("offset overflow");

  const lines = [];
  lines.push("/**");
  lines.push(" * AUTO-GENERATED — SVG üzerindeki plaka metni (şema bölüm sırası = coords).");
  lines.push(" * Kaynak: public/seatplans/theaterduisburg-seat-display-labels.json (seat-001… sırası).");
  lines.push(" * Üret: node scripts/build-duisburg-svg-section-labels.mjs");
  lines.push(" * Harf+rakam etiketlerde venue_plate 0 olabilir; dairede seat_display_label kullanılır.");
  lines.push(` * İlk ${used} etiket kullanıldı (${labels.length} kaynak).`);
  lines.push(" */");
  lines.push("");
  lines.push("/** Normalize bölüm adı → SVG coords ile aynı uzunlukta etiket listesi */");
  lines.push(
    "export const THEATER_DUISBURG_SVG_LABELS_BY_SECTION: Record<string, readonly string[]> = {"
  );

  for (const key of sectionOrder) {
    const arr = record[key];
    lines.push(`  ${JSON.stringify(key)}: [`);
    for (const lab of arr) {
      lines.push(`    ${JSON.stringify(lab)},`);
    }
    lines.push(`  ],`);
  }

  lines.push("};");
  lines.push("");
  fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
  console.log("Wrote", path.relative(ROOT, OUT), "used", used, "of", labels.length, "labels");
}

main();
