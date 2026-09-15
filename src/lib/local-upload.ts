import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_UPLOAD_DIR = "/data/kurdevents/uploads";

export function getLocalUploadDir(): string {
  return process.env.LOCAL_UPLOAD_DIR?.trim() || DEFAULT_UPLOAD_DIR;
}

export function getLocalUploadPublicUrl(relativePath: string): string {
  const normalized = relativePath.replace(/^\/+/, "");
  return `${getPublicBaseUrl()}/api/uploads/${normalized}`;
}

function getPublicBaseUrl(): string {
  const raw = (process.env.LOCAL_UPLOAD_PUBLIC_URL?.trim() || "").replace(/\/+$/, "");

  if (!raw) return "https://uploads.kurdevents.com";

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  // Keep legacy deployments from generating URLs through the old CDN host.
  if (withProtocol === "https://cdn.kurdevents.com") {
    return "https://uploads.kurdevents.com";
  }

  return withProtocol;
}

function safeFolder(folder: string): string {
  const normalized = folder
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
  if (!normalized || normalized.includes("..") || !/^[a-zA-Z0-9/_-]+$/.test(normalized)) {
    throw new Error("Geçersiz upload klasörü");
  }
  return normalized;
}

export async function saveLocalUpload(file: File, folder: string): Promise<{ url: string; fileName: string }> {
  const safe = safeFolder(folder);
  const extension = path.extname(file.name).toLowerCase() || ".bin";
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const relativePath = `${safe}/${fileName}`;
  const absolutePath = path.join(getLocalUploadDir(), relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  return {
    fileName: relativePath,
    url: getLocalUploadPublicUrl(relativePath),
  };
}
