import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp, { type OutputInfo } from "sharp";

import { dataPath } from "@/lib/env";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_SIDE = 2560;
const THUMB_SIDE = 480;
const QUALITY = 82;

export function uploadsRoot() {
  return dataPath("uploads");
}

/** Resolves a stored relative path inside the uploads folder; returns null on path traversal. */
export function resolveUploadPath(relative: string) {
  const root = uploadsRoot();
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

export class UploadError extends Error {}

export type StoredImage = { filePath: string; thumbPath: string; width: number; height: number };

/** Converts an uploaded image to WebP (longest side ≤ 2560 px) plus a 480 px thumbnail. */
export async function storeImage(input: Buffer, mimeType: string): Promise<StoredImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("Die Datei ist grösser als 15 MB.");
  if (mimeType && !ACCEPTED_TYPES.includes(mimeType.toLowerCase())) {
    throw new UploadError("Nur JPEG, PNG, WebP oder HEIC werden unterstützt.");
  }
  const now = new Date();
  const folder = path.join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"));
  const id = randomUUID();
  const filePath = path.posix.join(folder.split(path.sep).join("/"), `${id}.webp`);
  const thumbPath = path.posix.join(folder.split(path.sep).join("/"), `${id}_thumb.webp`);

  let main: { data: Buffer; info: OutputInfo };
  let thumb: Buffer;
  try {
    const base = sharp(input, { failOn: "error" }).rotate();
    main = await base
      .clone()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer({ resolveWithObject: true });
    thumb = await base
      .clone()
      .resize({ width: THUMB_SIDE, height: THUMB_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
  } catch {
    throw new UploadError(
      mimeType.includes("hei")
        ? "HEIC-Bilder konnten nicht gelesen werden. Bitte als JPEG oder PNG hochladen."
        : "Das Bild konnte nicht gelesen werden.",
    );
  }

  const absolute = resolveUploadPath(filePath);
  const absoluteThumb = resolveUploadPath(thumbPath);
  if (!absolute || !absoluteThumb) throw new UploadError("Ungültiger Speicherpfad.");
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, main.data);
  await writeFile(absoluteThumb, thumb);
  return { filePath, thumbPath, width: main.info.width, height: main.info.height };
}

/** Removes stored files (missing files are ignored). */
export async function deleteStoredFiles(paths: string[]) {
  await Promise.all(
    paths.map(async (p) => {
      const absolute = resolveUploadPath(p);
      if (absolute) await rm(absolute, { force: true });
    }),
  );
}
