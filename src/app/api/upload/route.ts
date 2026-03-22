import { NextRequest, NextResponse } from "next/server";
import { validateImageFile } from "@/lib/image-standards";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getAuthToken, requireRoleWithAccessToken } from "@/lib/api-auth";

const BUCKET = "uploads";

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi" }, { status: 400 });
  }

  const headerToken = getAuthToken(request);
  const formTokenRaw = formData.get("access_token");
  const formToken = typeof formTokenRaw === "string" ? formTokenRaw.trim() : "";
  const accessToken = headerToken || formToken || null;

  const auth = await requireRoleWithAccessToken(accessToken, ["admin", "organizer"]);
  if (auth instanceof Response) return auth;

  try {
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "images";

    if (!file) {
      return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
    }

    const err = validateImageFile(file, false);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 12)}.${ext}`;

    const supabase = getSupabaseAdmin();
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Dosya yüklenemedi" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Dosya yüklenemedi" }, { status: 500 });
  }
}
