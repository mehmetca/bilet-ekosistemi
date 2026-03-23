/**
 * Theater Duisburg SVG: koltuk path'lerinin merkezlerini (0–1) çıkarır,
 * şablondaki bölüm dikdörtgenlerine göre gruplar ve grid hedefine en yakın
 * eşleştirme ile DB sırasıyla uyumlu koordinat listesi üretir.
 *
 * Çalıştır: node scripts/build-duisburg-svg-seat-coords.js
 * Ardından (Duisburg plaka metinleri): npm run seatplan:duisburg-section-labels
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "public/seatplans/theaterduisburg.svg");
const OUT = path.join(ROOT, "src/lib/seating-plans/theaterduisburg-svg-coords.generated.ts");

const W = 1207.56;
const H = 858.9;

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

/** Şablondaki bölümler (theaterduisburg.ts ile aynı sıra) */
const SECTIONS = [
  { name: "1. PARKETT", x: 0.24, y: 0.348, width: 0.334, height: 0.128, rows: 10, seatsPerRow: 16 },
  { name: "2. PARKETT", x: 0.212, y: 0.456, width: 0.364, height: 0.118, rows: 7, seatsPerRow: 20 },
  { name: "3. PARKETT", x: 0.178, y: 0.556, width: 0.4, height: 0.108, rows: 6, seatsPerRow: 24 },
  { name: "PARKETT", x: 0.188, y: 0.642, width: 0.382, height: 0.092, rows: 4, seatsPerRow: 20 },
  { name: "PARKETT LOGEN LINKS", x: 0.054, y: 0.415, width: 0.132, height: 0.285, rows: 8, seatsPerRow: 4 },
  { name: "PARKETT LOGEN RECHTS", x: 0.814, y: 0.415, width: 0.132, height: 0.285, rows: 8, seatsPerRow: 4 },
  { name: "1. RANG LINKS", x: 0.048, y: 0.498, width: 0.112, height: 0.152, rows: 5, seatsPerRow: 6 },
  { name: "1. RANG RECHTS", x: 0.84, y: 0.498, width: 0.112, height: 0.152, rows: 5, seatsPerRow: 6 },
  { name: "2. RANG LINKS", x: 0.05, y: 0.624, width: 0.102, height: 0.118, rows: 3, seatsPerRow: 5 },
  { name: "2. RANG RECHTS", x: 0.848, y: 0.624, width: 0.102, height: 0.118, rows: 3, seatsPerRow: 5 },
  { name: "MITTE LINKS", x: 0.168, y: 0.708, width: 0.304, height: 0.168, rows: 9, seatsPerRow: 14 },
  { name: "MITTE RECHTS", x: 0.528, y: 0.708, width: 0.304, height: 0.168, rows: 9, seatsPerRow: 14 },
];

function normSectionName(s) {
  return String(s)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizePathD(d) {
  const re = /([MmLlHhVvCcZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi;
  const out = [];
  let m;
  while ((m = re.exec(d))) {
    if (m[1]) out.push(m[1]);
    else out.push(parseFloat(m[2]));
  }
  return out;
}

function pathLocalBBox(d) {
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const ax = (px, py) => {
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  };
  ax(0, 0);
  const tokens = tokenizePathD(d);
  let i = 0;
  const isCmd = (t) => typeof t === "string" && /^[MmLlHhVvCcZz]$/.test(t);
  let cmd = "M";
  while (i < tokens.length) {
    if (isCmd(tokens[i])) {
      cmd = tokens[i++];
      continue;
    }
    const rel = cmd === cmd.toLowerCase();
    const up = (vx, vy) => {
      const nx = rel ? x + vx : vx;
      const ny = rel ? y + vy : vy;
      x = nx;
      y = ny;
      ax(nx, ny);
    };
    switch (cmd) {
      case "M":
      case "m": {
        const vx = tokens[i++];
        const vy = tokens[i++];
        const nx = rel ? x + vx : vx;
        const ny = rel ? y + vy : vy;
        startX = nx;
        startY = ny;
        x = nx;
        y = ny;
        ax(x, y);
        cmd = cmd === "M" ? "L" : "l";
        while (i + 1 < tokens.length && typeof tokens[i] === "number" && typeof tokens[i + 1] === "number") {
          up(tokens[i++], tokens[i++]);
        }
        break;
      }
      case "L":
      case "l":
        up(tokens[i++], tokens[i++]);
        break;
      case "H":
      case "h": {
        const vx = tokens[i++];
        const nx = rel ? x + vx : vx;
        x = nx;
        ax(x, y);
        break;
      }
      case "V":
      case "v": {
        const vy = tokens[i++];
        const ny = rel ? y + vy : vy;
        y = ny;
        ax(x, y);
        break;
      }
      case "C":
      case "c": {
        const x1 = tokens[i++];
        const y1 = tokens[i++];
        const x2 = tokens[i++];
        const y2 = tokens[i++];
        const x3 = tokens[i++];
        const y3 = tokens[i++];
        const ax1 = rel ? x + x1 : x1;
        const ay1 = rel ? y + y1 : y1;
        const ax2 = rel ? x + x2 : x2;
        const ay2 = rel ? y + y2 : y2;
        const ax3 = rel ? x + x3 : x3;
        const ay3 = rel ? y + y3 : y3;
        ax(ax1, ay1);
        ax(ax2, ay2);
        ax(ax3, ay3);
        x = ax3;
        y = ay3;
        break;
      }
      case "Z":
      case "z":
        x = startX;
        y = startY;
        break;
      default:
        i++;
    }
  }
  if (!Number.isFinite(minX)) return { cx: 0, cy: 0 };
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function parsePaths(svg) {
  const re = /<path\b([^>]*?)>/g;
  const out = [];
  let m;
  while ((m = re.exec(svg))) {
    const tag = m[1];
    const tm = tag.match(/transform="matrix\(1,0,0,-1,([0-9.]+),([0-9.]+)\)"/);
    if (!tm) continue;
    const tx = Number(tm[1]);
    const ty = Number(tm[2]);
    const dm = tag.match(/\bd="([^"]*)"/);
    const fillM = tag.match(/\bfill="([^"]*)"/);
    const fill = fillM ? fillM[1] : "";
    if (!SEAT_FILLS.has(fill)) continue;
    const d = dm ? dm[1] : "";
    if (d.length > 280 || !/^M0 0/.test(d)) continue;
    const { cx, cy } = pathLocalBBox(d);
    const xSvg = tx + cx;
    const ySvg = ty - cy;
    const nx = xSvg / W;
    const ny = ySvg / H;
    out.push({ nx, ny, tx, ty, fill });
  }
  return out;
}

function dedupePoints(arr) {
  const seen = new Set();
  const kept = [];
  for (const p of arr) {
    const k = `${Math.round(p.nx * 5000)},${Math.round(p.ny * 5000)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    kept.push(p);
  }
  return kept;
}

function gridTarget(sec, rowIndex, seatIndex) {
  const seatsInRow = typeof sec.seatsPerRow === "function" ? sec.seatsPerRow(rowIndex) : sec.seatsPerRow;
  const maxRow = Math.max(1, sec.rows);
  const ri = Math.min(Math.max(0, rowIndex), maxRow - 1);
  const along = Math.max(1, seatsInRow);
  const si = Math.min(Math.max(0, seatIndex), along - 1);
  return {
    x: sec.x + ((si + 0.5) / along) * sec.width,
    y: sec.y + ((ri + 0.5) / maxRow) * sec.height,
  };
}

function sectionSeatCount(sec) {
  let n = 0;
  for (let ri = 0; ri < sec.rows; ri++) {
    const spr = typeof sec.seatsPerRow === "function" ? sec.seatsPerRow(ri) : sec.seatsPerRow;
    n += spr;
  }
  return n;
}

function buildTargets(sec) {
  const targets = [];
  for (let ri = 0; ri < sec.rows; ri++) {
    const spr = typeof sec.seatsPerRow === "function" ? sec.seatsPerRow(ri) : sec.seatsPerRow;
    for (let si = 0; si < spr; si++) {
      targets.push(gridTarget(sec, ri, si));
    }
  }
  return targets;
}

function dist2(a, b) {
  const dx = a.nx - b.x;
  const dy = a.ny - b.y;
  return dx * dx + dy * dy;
}

/**
 * Hedef grid noktalarına en yakın SVG merkezlerini bire bir eşler.
 * @param {{ p: { nx: number; ny: number }; idx: number }[]} candidates
 */
function matchGreedy(candidates, targets) {
  const used = new Set();
  const out = [];
  const usedFullIdx = [];
  for (let ti = 0; ti < targets.length; ti++) {
    const t = targets[ti];
    let bestJ = -1;
    let bestD = Infinity;
    for (let j = 0; j < candidates.length; j++) {
      if (used.has(j)) continue;
      const d = dist2(candidates[j].p, t);
      if (d < bestD) {
        bestD = d;
        bestJ = j;
      }
    }
    if (bestJ < 0) return null;
    used.add(bestJ);
    const c = candidates[bestJ];
    out.push({ nx: c.p.nx, ny: c.p.ny });
    usedFullIdx.push(c.idx);
  }
  return { coords: out, usedFullIdx };
}

function main() {
  const svg = fs.readFileSync(SRC, "utf8");
  let all = parsePaths(svg);
  all = dedupePoints(all);
  const byNormName = {};
  const log = [];
  const usedGlobal = new Set();

  const needTotal = SECTIONS.reduce((s, sec) => s + sectionSeatCount(sec), 0);
  log.push(`SVG points (deduped): ${all.length}, template targets: ${needTotal}`);

  /** Şema sırasıyla: her bölüm kendi grid hedeflerine, henüz kullanılmamış tüm SVG noktaları arasından en yakın eşlemeyi alır (dikdörtgen kırpması yok). */
  for (const sec of SECTIONS) {
    const targets = buildTargets(sec);
    const need = targets.length;
    const candidates = [];
    for (let i = 0; i < all.length; i++) {
      if (usedGlobal.has(i)) continue;
      candidates.push({ p: all[i], idx: i });
    }
    if (candidates.length < need) {
      log.push(`${sec.name}: FAIL only ${candidates.length} free pts, need ${need}`);
      byNormName[normSectionName(sec.name)] = null;
      continue;
    }
    const matched = matchGreedy(candidates, targets);
    if (!matched) {
      byNormName[normSectionName(sec.name)] = null;
      continue;
    }
    byNormName[normSectionName(sec.name)] = matched.coords;
    for (const idx of matched.usedFullIdx) usedGlobal.add(idx);
    log.push(`${sec.name}: matched ${matched.coords.length}`);
  }

  const lines = [];
  lines.push("/**");
  lines.push(" * AUTO-GENERATED — theaterduisburg.svg path merkezleri + bölüm eşlemesi.");
  lines.push(" * Yenile: node scripts/build-duisburg-svg-seat-coords.js");
  lines.push(" */");
  lines.push("");
  lines.push("export type SvgSeatCoord = { nx: number; ny: number };");
  lines.push("");
  lines.push(
    "/** Bölüm adı normalize (küçük harf, tek boşluk) → şema sırasındaki koltuk listesi */"
  );
  lines.push("export const THEATER_DUISBURG_SVG_COORDS_BY_SECTION: Record<string, SvgSeatCoord[] | null> = {");
  for (const sec of SECTIONS) {
    const k = normSectionName(sec.name);
    const arr = byNormName[k];
    if (!arr) {
      lines.push(`  ${JSON.stringify(k)}: null,`);
      continue;
    }
    lines.push(`  ${JSON.stringify(k)}: [`);
    for (const c of arr) {
      lines.push(`    { nx: ${c.nx.toFixed(6)}, ny: ${c.ny.toFixed(6)} },`);
    }
    lines.push(`  ],`);
  }
  lines.push("};");
  lines.push("");
  fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
  console.log(log.join("\n"));
  console.log("Wrote", path.relative(ROOT, OUT));
}

main();
