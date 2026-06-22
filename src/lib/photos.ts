import { supabase } from "@/integrations/supabase/client";

const BUCKET = "workshop-photos";

export async function uploadPhoto(file: File, prefix: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
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