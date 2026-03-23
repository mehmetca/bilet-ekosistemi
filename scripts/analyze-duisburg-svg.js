/**
 * theaterduisburg.svg — koltuk path sayısı ve şema özeti (12 bölüm, 930 DB koltuğu).
 * Çalıştır: node scripts/analyze-duisburg-svg.js
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "../public/seatplans/theaterduisburg.svg");
const SEAT_FILLS = new Set([
  "#f3c206",
  "#db82b5",
  "#f47920",
  "#00c0f3",
  "#00a1cb",
  "#66952d",
  "#6f2b90",
  "#004071",
  "#c2c4c4",
]);

const SECTIONS = [
  { name: "1. PARKETT", rows: 10, seatsPerRow: 16 },
  { name: "2. PARKETT", rows: 7, seatsPerRow: 20 },
  { name: "3. PARKETT", rows: 6, seatsPerRow: 24 },
  { name: "PARKETT", rows: 4, seatsPerRow: 20 },
  { name: "PARKETT LOGEN LINKS", rows: 8, seatsPerRow: 4 },
  { name: "PARKETT LOGEN RECHTS", rows: 8, seatsPerRow: 4 },
  { name: "1. RANG LINKS", rows: 5, seatsPerRow: 6 },
  { name: "1. RANG RECHTS", rows: 5, seatsPerRow: 6 },
  { name: "2. RANG LINKS", rows: 3, seatsPerRow: 5 },
  { name: "2. RANG RECHTS", rows: 3, seatsPerRow: 5 },
  { name: "MITTE LINKS", rows: 9, seatsPerRow: 14 },
  { name: "MITTE RECHTS", rows: 9, seatsPerRow: 14 },
];

const svg = fs.readFileSync(SRC, "utf8");
const re = /<path\b([^>]*?)>/g;
let m;
let c = 0;
while ((m = re.exec(svg))) {
  const tag = m[1];
  if (!/transform="matrix\(1,0,0,-1,([0-9.]+),([0-9.]+)\)"/.test(tag)) continue;
  const fm = tag.match(/\bfill="([^"]*)"/);
  if (!SEAT_FILLS.has(fm ? fm[1] : "")) continue;
  const dm = tag.match(/\bd="([^"]*)"/);
  const d = dm ? dm[1] : "";
  if (d.length > 280 || !/^M0 0/.test(d)) continue;
  c++;
}

const dbTotal = SECTIONS.reduce((s, x) => s + x.rows * x.seatsPerRow, 0);
console.log("=== Theater Duisburg SVG özeti ===");
console.log("Tespit edilen koltuk path (tahmini):", c);
console.log("Şema bölüm sayısı:", SECTIONS.length);
console.log("Veritabanı şablonu toplam koltuk:", dbTotal);
console.log("Bölümler:");
SECTIONS.forEach((x) => {
  console.log(`  - ${x.name}: ${x.rows} sıra × ${x.seatsPerRow} = ${x.rows * x.seatsPerRow}`);
});
