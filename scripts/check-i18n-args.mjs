#!/usr/bin/env node
// messages/*.json şablonlarındaki ICU placeholder'ları ile t() çağrılarının verdiği
// argümanları karşılaştırır. Eksik argüman = çalışma zamanında FORMATTING_ERROR.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LOCALES = readdirSync(path.join(ROOT, "messages"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, p, out);
    else if (typeof v === "string") out.set(p, v);
  }
  return out;
}

function paramsOf(text) {
  const set = new Set();
  for (const m of text.matchAll(/\\?\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)) set.add(m[1]);
  for (const m of text.matchAll(/\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*(?:plural|selectnumber|select)\b/g)) set.add(m[1]);
  return set;
}

const required = new Map();
for (const locale of LOCALES) {
  const messages = flatten(JSON.parse(readFileSync(path.join(ROOT, "messages", `${locale}.json`), "utf8")), "", new Map());
  for (const [key, text] of messages) {
    if (!required.has(key)) required.set(key, new Map());
    required.get(key).set(locale, paramsOf(text));
  }
}

function walk(dir, acc) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(entry)) acc.push(p);
  }
  return acc;
}

function balancedBody(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return null;
}

const CALL = /\b([A-Za-z_$][\w$]*)\(\s*(?:"([^"]+)"|'([^']+)'|`([^`$]+)`)\s*(,)?/g;
const NS_BIND =
  /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:use|get)Translations\(\s*(?:"([^"]*)"|'([^']*)')?\s*\)/g;
const NS_DYNAMIC = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:use|get)Translations\(\s*[A-Za-z_$][\w$]*\s*\)/g;

const findings = [];
for (const file of walk(path.join(ROOT, "src"), [])) {
  const src = readFileSync(file, "utf8");
  const namespaces = new Map();
  for (const m of src.matchAll(NS_BIND)) namespaces.set(m[1], m[2] ?? m[3] ?? "");
  for (const m of src.matchAll(NS_DYNAMIC)) namespaces.set(m[1], null);

  for (const m of src.matchAll(CALL)) {
    const [, fn, dq, sq, tq, hasSecondArg] = m;
    if (!namespaces.has(fn)) continue;
    const ns = namespaces.get(fn);
    if (ns === null) continue;
    const key = dq ?? sq ?? tq;
    const fullKey = ns && !key.includes(".") ? `${ns}.${key}` : key;
    const perLocale = required.get(fullKey);
    if (!perLocale) continue;

    const line = src.slice(0, m.index).split("\n").length;
    let provided = new Set();
    if (hasSecondArg) {
      const after = src.slice(m.index + m[0].length);
      const openIdx = after.indexOf("{");
      const closeIdx = after.indexOf(")");
      if (openIdx >= 0 && (closeIdx < 0 || openIdx < closeIdx)) {
        const body = balancedBody(after, openIdx);
        if (body !== null && !body.includes("...")) {
          const trimmed = body.trim();
          for (const p of trimmed.matchAll(/(?:^|[,{]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)) provided.add(p[1]);
          for (const p of trimmed.matchAll(/(?:^|[,{]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=[,}]|$)/g)) provided.add(p[1]);
        }
      }
    }

    const missing = new Map();
    for (const [locale, need] of perLocale) {
      for (const p of need) {
        if (!provided.has(p)) {
          if (!missing.has(p)) missing.set(p, []);
          missing.get(p).push(locale);
        }
      }
    }
    if (missing.size) {
      findings.push({
        file: path.relative(ROOT, file),
        line,
        key: fullKey,
        detail: [...missing].map(([p, ls]) => `{${p}} (${ls.join(",")})`).join(" "),
      });
    }
  }
}

for (const f of findings) console.log(`${f.file}:${f.line}  ${f.key} -> eksik ${f.detail}`);
console.log(`\n${findings.length ? findings.length + " çağrı eksik argüman veriyor" : "tüm t() çağrıları şablon argümanlarını veriyor"} (${LOCALES.join("/")})`);
process.exitCode = findings.length ? 1 : 0;
