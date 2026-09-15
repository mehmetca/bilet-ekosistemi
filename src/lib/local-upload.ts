import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_UPLOAD_DIR = "/data/kurdevents/uploads";

export function getLocalUploadDir(): string {
  return process.env.LOCAL_UPLOAD_DIR?.trim() || DEFAULT_UPLOAD_DIR;
}

export function getLocalUploadPublicUrl(relativePath: string): string {
  return `${getPublicBaseUrl()}/images/${relativePath}`;
}

function getPublicBaseUrl(): string {
  return (process.env.LOCAL_UPLOAD_PUBLIC_URL?.trim() || "https://cdn.kurdevents.com").replace(/\/$/, "");
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
