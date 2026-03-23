/**
 * Cursor agent-transcript (.jsonl) satırındaki ilk seat JSON dizisinden label listesi üretir (1068).
 * Çıktı: public/seatplans/theaterduisburg-seat-display-labels.json
 *
 * Ortam:
 *   DUISBURG_LABELS_TRANSCRIPT — .jsonl dosyası (mutlak veya proje köküne göre)
 *   DUISBURG_LABELS_JSONL_LINE — 0 tabanlı satır indeksi (varsayılan 166)
 *
 * Transcript yoksa: public/seatplans/theaterduisburg-seat-display-labels.json dosyasını elle düzenleyin.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const _home = process.env.USERPROFILE || process.env.HOME || "";
const DEFAULT_TRANSCRIPT = _home
  ? path.join(
      _home,
      ".cursor/projects/c-bilet-ekosistemi/agent-transcripts/c6477f0c-3e51-4b04-9d70-b08890816bc5/c6477f0c-3e51-4b04-9d70-b08890816bc5.jsonl"
    )
  : "";

function parseFirstJsonArray(s) {
  const start = s.indexOf("[");
  if (start < 0) throw new Error("no [");
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(start, i + 1));
    }
  }
  throw new Error("unclosed array");
}

function main() {
  const transcriptPath = process.env.DUISBURG_LABELS_TRANSCRIPT
    ? path.isAbsolute(process.env.DUISBURG_LABELS_TRANSCRIPT)
      ? process.env.DUISBURG_LABELS_TRANSCRIPT
      : path.join(ROOT, process.env.DUISBURG_LABELS_TRANSCRIPT)
    : DEFAULT_TRANSCRIPT;

  if (!transcriptPath || !fs.existsSync(transcriptPath)) {
    console.error(
      "Transcript bulunamadı:",
      transcriptPath,
      "\nDUISBURG_LABELS_TRANSCRIPT ayarlayın veya seat-display-labels.json dosyasını doğrudan düzenleyin."
    );
    process.exit(1);
  }

  const lineIndex = Math.max(0, parseInt(process.env.DUISBURG_LABELS_JSONL_LINE || "166", 10) || 0);
  const lines = fs.readFileSync(transcriptPath, "utf8").split("\n");
  const line = lines[lineIndex];
  if (line == null || line === "") {
    console.error("JSONL satırı boş veya yok:", lineIndex);
    process.exit(1);
  }
  const o = JSON.parse(line);
  const text = o.message.content[0].text;
  const m = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/);
  if (!m) throw new Error("no user_query");
  const arr = parseFirstJsonArray(m[1].trim());
  const labels = arr.map((x) => String(x.label ?? ""));
  if (labels.length !== 1068) throw new Error(`expected 1068 labels, got ${labels.length}`);
  const out = path.join(ROOT, "public/seatplans/theaterduisburg-seat-display-labels.json");
  fs.writeFileSync(out, JSON.stringify(labels, null, 0) + "\n", "utf8");
  console.log("Wrote", path.relative(ROOT, out), labels.length);
}

main();
