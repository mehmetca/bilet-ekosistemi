import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outputRoot = path.resolve(process.env.LOCAL_UPLOAD_DIR || "/data/kurdevents/uploads");
const dryRun = process.argv.includes("--dry-run");
const delayMs = Number.parseInt(process.env.MIGRATE_STORAGE_DELAY_MS || "250", 10);
const buckets = (process.env.MIGRATE_STORAGE_BUCKETS || "uploads,hero-backgrounds,advertisements,tour-events,artists,event-images")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!supabaseUrl || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli");

const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
const imageExtensions = /\.(avif|gif|jpe?g|png|webp)$/i;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, options, label) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url, options);
    if (response.status !== 429) return response;
    const retryAfter = Number.parseInt(response.headers.get("retry-after") || "", 10);
    const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : Math.min(30_000, 1000 * 2 ** attempt);
    console.warn(`${label}: 429, ${waitMs}ms bekleniyor (${attempt + 1}/6)`);
    await sleep(waitMs);
  }
  throw new Error(`${label}: rate limit devam ediyor`);
}

async function listFolder(bucket, prefix = "") {
  const response = await fetchWithRetry(
    `${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
    },
    `Listeleme ${bucket}/${prefix}`,
  );
  if (!response.ok) throw new Error(`Listeleme başarısız (${bucket}/${prefix}): ${response.status} ${await response.text()}`);
  return response.json();
}

async function* walk(bucket, prefix = "") {
  const entries = await listFolder(bucket, prefix);
  for (const entry of entries) {
    if (!entry?.name || entry.name.startsWith(".")) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id == null) {
      yield* walk(bucket, relative);
    } else if (imageExtensions.test(entry.name)) {
      yield relative;
    }
  }
}

function targetFor(bucket, objectPath) {
  // Storage object paths already contain their folder. Do not prepend the bucket again.
  return path.join(outputRoot, objectPath.split("/").join(path.sep));
}

async function download(bucket, objectPath) {
  const target = targetFor(bucket, objectPath);
  try {
    await stat(target);
    return { target, skipped: true };
  } catch {
    // File does not exist; continue with download.
  }

  if (dryRun) return { target, skipped: false, dryRun: true };

  const response = await fetchWithRetry(
    `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
    { headers },
    `İndirme ${bucket}/${objectPath}`,
  );
  if (!response.ok) throw new Error(`İndirme başarısız (${bucket}/${objectPath}): ${response.status} ${await response.text()}`);

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return { target, skipped: false };
}

console.log(dryRun ? "DRY-RUN: dosya indirme yapılmayacak" : "Migration başlıyor");

for (const bucket of buckets) {
  let count = 0;
  let skipped = 0;
  for await (const objectPath of walk(bucket)) {
    const result = await download(bucket, objectPath);
    count += 1;
    if (result.skipped) skipped += 1;
    console.log(`[${bucket}] ${count}: ${objectPath} -> ${result.target}${result.skipped ? " (atlandı)" : ""}`);
    if (!result.skipped && !dryRun) await sleep(delayMs);
  }
  console.log(`[${bucket}] tamamlandı: ${count} dosya, ${skipped} atlandı`);
}
