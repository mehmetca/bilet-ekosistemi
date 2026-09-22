import { NextRequest, NextResponse } from "next/server";
import { validateImageFile } from "@/lib/image-standards";
import { saveLocalUpload } from "@/lib/local-upload";
import { getAuthToken, requireRoleWithAccessToken } from "@/lib/api-auth";

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

    const err = await validateImageFile(file, false);
    if (err) {
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const saved = await saveLocalUpload(file, folder);

    return NextResponse.json({
      success: true,
      url: saved.url,
      fileName: saved.fileName,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Dosya yüklenemedi" }, { status: 500 });
  }
}
