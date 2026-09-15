import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outputRoot = process.env.LOCAL_UPLOAD_DIR || "/data/kurdevents/uploads";
const buckets = (process.env.MIGRATE_STORAGE_BUCKETS || "uploads,hero-backgrounds,advertisements,tour-events,artists,event-images")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (!supabaseUrl || !serviceKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli");

const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
const imageExtensions = /\.(avif|gif|jpe?g|png|webp)$/i;

async function listFolder(bucket, prefix = "") {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
  });
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

async function download(bucket, objectPath) {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, { headers });
  if (!response.ok) throw new Error(`İndirme başarısız (${bucket}/${objectPath}): ${response.status}`);
  const target = path.join(outputRoot, bucket, ...objectPath.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
  return target;
}

for (const bucket of buckets) {
  let count = 0;
  for await (const objectPath of walk(bucket)) {
    const target = await download(bucket, objectPath);
    count += 1;
    console.log(`[${bucket}] ${count}: ${objectPath} -> ${target}`);
  }
  console.log(`[${bucket}] tamamlandı: ${count} dosya`);
}
