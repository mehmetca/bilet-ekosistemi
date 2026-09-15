import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireRoleWithAccessToken, getAuthToken } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getLocalUploadDir, getLocalUploadPublicUrl } from "@/lib/local-upload";

const BUCKET = "uploads";
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)$/i;
const LOCAL_PREFIX = "local:";

type ImageEntry = { path: string; url: string; name: string };

type LocalDirent = { name: string; isDirectory(): boolean };

async function listLocalImages(folder: string, limit: number): Promise<ImageEntry[]> {
  const root = path.resolve(getLocalUploadDir());
  const folderPath = path.resolve(root, folder);
  if (folderPath !== root && !folderPath.startsWith(`${root}${path.sep}`)) return [];

  const result: ImageEntry[] = [];
  async function visit(current: string): Promise<void> {
    if (result.length >= limit) return;
    let entries: LocalDirent[];
    try {
      entries = (await readdir(current, { withFileTypes: true })) as LocalDirent[];
    } catch {
      return;
    }

    for (const entry of entries) {
      if (result.length >= limit || entry.name.startsWith(".")) break;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (!IMAGE_EXT.test(entry.name)) continue;

      const relative = path.relative(root, absolute).split(path.sep).join("/");
      result.push({
        path: `${LOCAL_PREFIX}${relative}`,
        url: getLocalUploadPublicUrl(relative),
        name: entry.name,
      });
    }
  }

  await visit(folderPath);
  return result;
}

/** Admin/org üyeleri hem local hem Supabase görsellerini silebilir. */
export async function DELETE(request: NextRequest) {
  const accessToken = getAuthToken(request);
  const auth = await requireRoleWithAccessToken(accessToken, ["admin", "organizer"]);
  if (auth instanceof NextResponse) return auth;

  let body: { paths?: string[] };
  try {
    body = (await request.json()) as { paths?: string[] };
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const paths = Array.isArray(body?.paths)
    ? body.paths.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
    : [];
  if (paths.length === 0) return NextResponse.json({ error: "Silinecek dosya belirtilmedi." }, { status: 400 });

  try {
    const localPaths = paths.filter((p) => p.startsWith(LOCAL_PREFIX)).map((p) => p.slice(LOCAL_PREFIX.length));
    const remotePaths = paths.filter((p) => !p.startsWith(LOCAL_PREFIX));
    const root = path.resolve(getLocalUploadDir());

    for (const relative of localPaths) {
      const absolute = path.resolve(root, relative);
      if (absolute !== root && absolute.startsWith(`${root}${path.sep}`)) await rm(absolute, { force: true });
    }

    if (remotePaths.length > 0) {
      const { error } = await getSupabaseAdmin().storage.from(BUCKET).remove(remotePaths);
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("image delete error:", error);
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const folder = (request.nextUrl.searchParams.get("folder") || "").replace(/^\/+/, "").trim();
  const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("limit") || "50") || 50));
  if (!folder) return NextResponse.json({ error: "folder required" }, { status: 400 });

  const accessToken = getAuthToken(request);
  const auth = await requireRoleWithAccessToken(accessToken, ["admin", "organizer"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const localImages = await listLocalImages(folder, limit);
    let remoteImages: ImageEntry[] = [];
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.storage.from(BUCKET).list(folder, {
        limit,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });
      remoteImages = (Array.isArray(data) ? data : [])
        .map((entry: { name?: string; id?: string | null }) => {
          const entryName = typeof entry?.name === "string" ? entry.name : null;
          if (!entryName || entryName.startsWith(".") || entry.id == null || !IMAGE_EXT.test(entryName)) return null;
          const filePath = entryName.startsWith(`${folder}/`) ? entryName : `${folder}/${entryName}`;
          const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
          return { path: filePath, url: publicData.publicUrl, name: entryName };
        })
        .filter(Boolean) as ImageEntry[];
    } catch {
      // Local files remain usable even if the legacy Supabase bucket is unavailable.
    }

    return NextResponse.json({ images: [...localImages, ...remoteImages].slice(0, limit) });
  } catch (error) {
    console.error("list-images error:", error);
    return NextResponse.json({ error: "Gorseller listelenemedi" }, { status: 500 });
  }
}
