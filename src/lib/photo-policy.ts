export const PHOTO_MAX_DIMENSION = 2400;
export const THUMB_MAX_DIMENSION = 800;
export const THUMB_MAX_BYTES = 200 * 1024;

export function photoDimensions(width: number, height: number, maxDimension: number) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Only paired uploads use this suffix; legacy photos safely retain their original. */
export function photoThumbnailPath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return path.replace(/\.full\.[^/.]+$/, ".thumb.jpg");
}

export function photoStoragePaths(path: string): string[] {
  return [...new Set([path, photoThumbnailPath(path)])];
}