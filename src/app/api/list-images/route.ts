import { NextRequest, NextResponse } from "next/server";
import { requireRoleWithAccessToken, getAuthToken } from "@/lib/api-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "uploads";
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)$/i;

export async function GET(request: NextRequest) {
  const folderRaw = request.nextUrl.searchParams.get("folder") || "";
  const limitRaw = request.nextUrl.searchParams.get("limit") || "50";
  const limit = Math.max(1, Math.min(100, Number(limitRaw) || 50));

  const folder = folderRaw.replace(/^\/+/, "").trim();
  if (!folder) {
    return NextResponse.json({ error: "folder required" }, { status: 400 });
  }

  const accessToken = getAuthToken(request);
  const auth = await requireRoleWithAccessToken(accessToken, ["admin", "organizer"]);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
      limit,
      offset: 0,
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) throw error;

    const files = Array.isArray(data) ? data : [];
    const images = files
      .map((entry: { name?: string; id?: string | null; metadata?: { mimetype?: string } | null }) => {
        const entryName = typeof entry?.name === "string" ? entry.name : null;
        if (!entryName || entryName.startsWith(".")) return null;
        // Klasör girdilerini atla (id null)
        if (entry.id == null && !IMAGE_EXT.test(entryName)) return null;
        if (!IMAGE_EXT.test(entryName)) return null;

        const filePath =
          entryName.startsWith(`${folder}/`) || entryName === folder
            ? entryName
            : `${folder}/${entryName}`;

        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

        return {
          path: filePath,
          url: publicUrl,
          name: entryName,
        };
      })
      .filter(Boolean) as Array<{ path: string; url: string; name: string }>;

    return NextResponse.json({ images });
  } catch (err) {
    console.error("list-images error:", err);
    return NextResponse.json({ error: "Gorseller listelenemedi" }, { status: 500 });
  }
}
