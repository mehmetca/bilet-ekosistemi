/**
 * Theater Duisburg SVG: koltuk path'lerini sepet renkleri + transform ile bulur,
 * seat-001 … id atar, JSON + etiketli SVG yazar.
 *
 * Çalıştır: node scripts/tag-duisburg-svg-seats.js
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "../public/seatplans/theaterduisburg.svg");
const OUT_SVG = path.join(__dirname, "../public/seatplans/theaterduisburg.tagged.svg");
const OUT_JSON = path.join(
  __dirname,
  "../public/seatplans/theaterduisburg-seats-from-svg.json"
);

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

const MAX_D_LEN = 280;
/** Aynı (tx,ty) için yinelenen path (≈1 birim) tek koltuk sayılır */
const DEDUP_ROUND = 1;
/** Aynı görsel sıra: ty yakın koltuklar bir satır */
const ROW_TY_TOL = 11;
/** Beyaz koltuk numarası → path merkezi en fazla bu px (viewBox birimleri) */
const LABEL_MATCH_MAX_DIST = 26;

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function parsePaths(s) {
  const re = /<path\b([^>]*?)>/g;
  const out = [];
  let m;
  while ((m = re.exec(s))) {
    const full = m[0];
    const tag = m[1];
    const start = m.index;
    const end = start + full.length;
    if (!/transform="matrix\(1,0,0,-1,([0-9.]+),([0-9.]+)\)"/.test(tag)) continue;
    const tm = tag.match(
      /transform="matrix\(1,0,0,-1,([0-9.]+),([0-9.]+)\)"/
    );
    const dm = tag.match(/\bd="([^"]*)"/);
    const fillM = tag.match(/\bfill="([^"]*)"/);
    const fill = fillM ? fillM[1] : "";
    if (!SEAT_FILLS.has(fill)) continue;
    const d = dm ? dm[1] : "";
    if (d.length > MAX_D_LEN || !/^M0 0/.test(d)) continue;
    const tx = Number(tm[1]);
    const ty = Number(tm[2]);
    out.push({ start, end, full, tag, tx, ty, fill });
  }
  return out;
}

function dedupeByPosition(paths) {
  const seen = new Map();
  const kept = [];
  for (const p of paths) {
    const k = `${Math.round(p.tx / DEDUP_ROUND)},${Math.round(p.ty / DEDUP_ROUND)}`;
    if (seen.has(k)) continue;
    seen.set(k, true);
    kept.push(p);
  }
  return kept;
}

function parseSvgMatrix(transformStr) {
  const m = transformStr.match(/matrix\(\s*([^)]+)\)/i);
  if (!m) return null;
  const nums = m[1]
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (nums.length !== 6 || nums.some((n) => Number.isNaN(n))) return null;
  return nums;
}

/** SVG matrix(a,b,c,d,e,f): x' = a*x + c*y + e, y' = b*x + d*y + f */
function svgPoint(mat, x, y) {
  const [a, b, c, d, e, f] = mat;
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

/** fill beyaz, içinde rakam tspans — koltuk üzerindeki numara */
function extractWhiteNumericLabels(svg) {
  const results = [];
  const textRe = /<text\b([^>]*?)>([\s\S]*?)<\/text>/gi;
  let m;
  while ((m = textRe.exec(svg))) {
    const attrs = m[1];
    const inner = m[2];
    const fillM = attrs.match(/\bfill="([^"]*)"/i);
    const fill = fillM
      ? fillM[1].toLowerCase().replace(/\s/g, "")
      : "";
    if (fill !== "#ffffff" && fill !== "#fff") continue;
    const transM = attrs.match(/\btransform="([^"]*)"/);
    if (!transM) continue;
    const mat = parseSvgMatrix(transM[1]);
    if (!mat) continue;
    const chunks = [];
    const tsRe = /<tspan\b([^>]*?)>([^<]*)<\/tspan>/gi;
    let t;
    while ((t = tsRe.exec(inner))) {
      const ta = t[1];
      const txt = t[2].trim();
      if (!txt) continue;
      const xm = ta.match(/\bx="([^"]*)"/);
      const ym = ta.match(/\by="([^"]*)"/);
      if (!xm || !ym) continue;
      const x = parseFloat(xm[1].trim().split(/\s+/)[0]);
      const y = parseFloat(ym[1].trim().split(/\s+/)[0]);
      if (Number.isNaN(x) || Number.isNaN(y)) continue;
      const pt = svgPoint(mat, x, y);
      chunks.push({ x: pt.x, y: pt.y, txt });
    }
    if (!chunks.length) continue;
    chunks.sort((a, b) => a.x - b.x);
    const label = chunks.map((c) => c.txt).join("");
    if (!/^\d{1,3}$/.test(label)) continue;
    const wx = chunks.reduce((s, c) => s + c.x, 0) / chunks.length;
    const wy = chunks.reduce((s, c) => s + c.y, 0) / chunks.length;
    results.push({ wx, wy, label });
  }
  return results;
}

function assignNearestLabels(seatList, textLabels) {
  const pairs = [];
  for (const s of seatList) {
    for (const L of textLabels) {
      const d = Math.hypot(s._tx - L.wx, s._ty - L.wy);
      if (d <= LABEL_MATCH_MAX_DIST) pairs.push({ d, s, L });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const usedSeat = new Set();
  const usedLbl = new Set();
  for (const { s, L } of pairs) {
    if (usedSeat.has(s.id)) continue;
    const lk = `${L.wx.toFixed(1)},${L.wy.toFixed(1)},${L.label}`;
    if (usedLbl.has(lk)) continue;
    usedSeat.add(s.id);
    usedLbl.add(lk);
    s.label = L.label;
  }
}

function assignRows(paths) {
  const sorted = [...paths].sort((a, b) => a.ty - b.ty || a.tx - b.tx);
  const rows = [];
  for (const p of sorted) {
    let row = rows.find((r) => Math.abs(p.ty - r.avgTy) <= ROW_TY_TOL);
    if (!row) {
      row = { avgTy: p.ty, seats: [] };
      rows.push(row);
    }
    row.seats.push(p);
    const n = row.seats.length;
    row.avgTy = row.seats.reduce((s, x) => s + x.ty, 0) / n;
  }
  rows.sort((a, b) => a.avgTy - b.avgTy);
  for (let ri = 0; ri < rows.length; ri++) {
    rows[ri].seats.sort((a, b) => a.tx - b.tx);
  }
  return rows;
}

function buildSeatList(rows) {
  const list = [];
  let global = 0;
  for (let ri = 0; ri < rows.length; ri++) {
    const rowLabel = String(ri + 1);
    const rowSeats = rows[ri].seats;
    for (let si = 0; si < rowSeats.length; si++) {
      global++;
      const id = `seat-${String(global).padStart(3, "0")}`;
      const number = si + 1;
      list.push({
        id,
        label: "",
        row: rowLabel,
        number,
        _tx: rowSeats[si].tx,
        _ty: rowSeats[si].ty,
        _path: rowSeats[si],
      });
    }
  }
  return list;
}

function injectIds(svg, seatList) {
  const replacements = seatList.map((item) => {
    const p = item._path;
    let tag = p.tag;
    if (/\bid="/.test(tag)) {
      tag = tag.replace(/\sid="[^"]*"/, "");
    }
    const lab = item.label ? ` data-label="${escapeAttr(item.label)}"` : "";
    const injected = ` id="${item.id}" data-row="${escapeAttr(item.row)}" data-number="${item.number}"${lab}`;
    const newTag = `<path${injected} ${tag.trimStart()}>`;
    return { start: p.start, end: p.end, newTag };
  });
  replacements.sort((a, b) => b.start - a.start);
  let out = svg;
  for (const r of replacements) {
    out = out.slice(0, r.start) + r.newTag + out.slice(r.end);
  }
  return out;
}

function main() {
  const svg = fs.readFileSync(SRC, "utf8");
  let paths = parsePaths(svg);
  paths = dedupeByPosition(paths);
  const rows = assignRows(paths);
  const seatList = buildSeatList(rows);
  const textLabels = extractWhiteNumericLabels(svg);
  assignNearestLabels(seatList, textLabels);

  const jsonOut = seatList.map(({ id, label, row, number }) => ({
    id,
    label,
    row,
    number,
  }));

  fs.writeFileSync(OUT_JSON, JSON.stringify(jsonOut, null, 2), "utf8");
  const tagged = injectIds(svg, seatList);
  fs.writeFileSync(OUT_SVG, tagged, "utf8");

  const withLab = jsonOut.filter((x) => x.label).length;
  console.log("Seats:", jsonOut.length);
  console.log("With numeric label from SVG:", withLab);
  console.log("Rows (clusters):", rows.length);
  console.log("Wrote", path.relative(process.cwd(), OUT_JSON));
  console.log("Wrote", path.relative(process.cwd(), OUT_SVG));
}

main();
