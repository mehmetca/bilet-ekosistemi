import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const UPLOAD_ROOT = path.resolve(process.env.LOCAL_UPLOAD_DIR?.trim() || "/data/kurdevents/uploads");
const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function resolveSafePath(parts: string[]): string | null {
  const relativePath = parts.join("/");
  const candidate = path.resolve(UPLOAD_ROOT, relativePath);
  if (candidate !== UPLOAD_ROOT && !candidate.startsWith(`${UPLOAD_ROOT}${path.sep}`)) return null;
  return candidate;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await context.params;
  const filePath = resolveSafePath(parts);
  if (!filePath) return new NextResponse("Not found", { status: 404 });

  try {
    const body = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    return new NextResponse(body, {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
