import { supabase } from "@/integrations/supabase/client";
import { PHOTO_MAX_DIMENSION, THUMB_MAX_DIMENSION, THUMB_MAX_BYTES, photoDimensions, photoThumbnailPath, photoStoragePaths } from "./photo-policy";

const BUCKET = "workshop-photos";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB hard cap per photo

/**
 * Downscale/recompress an image in the browser so no upload exceeds 2 MB,
 * regardless of the phone/camera that produced it.
 */
export async function compressImage(file: File, maxBytes = MAX_BYTES, maxDimension = PHOTO_MAX_DIMENSION, force = false): Promise<File> {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (!force && file.size <= maxBytes && file.type !== "image/heic") return file;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = photoDimensions(bitmap.width, bitmap.height, maxDimension);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    let quality = 0.85;
    let blob: Blob | null = null;

    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), "image/jpeg", quality),
      );
      if (!blob) break;
      if (blob.size <= maxBytes) break;
      if (quality > 0.5) quality -= 0.12;
      else {
        width = Math.round(width * 0.8);
        height = Math.round(height * 0.8);
      }
    }
    bitmap.close?.();
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

export async function uploadPhoto(file: File, prefix: string): Promise<string> {
  const compressed = await compressImage(file, MAX_BYTES, PHOTO_MAX_DIMENSION, true);
  const thumbnail = await compressImage(compressed, THUMB_MAX_BYTES, THUMB_MAX_DIMENSION, true);
  const paired = thumbnail !== compressed && thumbnail.size <= THUMB_MAX_BYTES;
  const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${prefix}/${crypto.randomUUID()}${paired ? ".full" : ""}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    upsert: false,
    contentType: compressed.type || "image/jpeg",
    cacheControl: "31536000",
  });
  if (error) throw error;
  if (paired) {
    const { error: thumbError } = await supabase.storage.from(BUCKET).upload(photoThumbnailPath(path), thumbnail, {
      upsert: false,
      contentType: "image/jpeg",
      cacheControl: "31536000",
    });
    if (thumbError) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw thumbError;
    }
  }
  return path;
}


export async function getSignedUrl(path: string, expiresInSec = 60 * 60 * 8): Promise<string> {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSec);
  return data?.signedUrl ?? "";
}

export async function getSignedUrls(paths: string[]): Promise<string[]> {
  if (!paths?.length) return [];
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 8);
  return (data ?? []).map((d) => d.signedUrl ?? "");
}

export async function getPhotoDisplayUrls(paths: string[]): Promise<string[]> {
  return getSignedUrls(paths.map(photoThumbnailPath));
}

export async function getPhotoDisplayUrl(path: string): Promise<string> {
  return getSignedUrl(photoThumbnailPath(path));
}

export async function removePhoto(path: string) {
  return supabase.storage.from(BUCKET).remove(photoStoragePaths(path));
}
