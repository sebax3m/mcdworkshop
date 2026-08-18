/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrls, uploadPhoto } from "@/lib/photos";
import { AlertTriangle, Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const PRINT_PREFIX = "CLAIM_DAMAGE: ";

export function ClaimDamageSection({ claimId, canEdit }: { claimId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const photos = useQuery({
    queryKey: ["claim-damage-photos", claimId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_photos")
        .select("id, storage_path, caption, created_at, sort_order")
        .ilike("caption", `${PRINT_PREFIX}${claimId}%`)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const urls = await getSignedUrls(rows.map((r) => r.storage_path));
      return rows.map((r, i) => ({ ...r, url: urls[i] }));
    },
  });

  async function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const list = [...((photos.data ?? []) as any[])];
    const from = list.findIndex((p) => p.id === fromId);
    const to = list.findIndex((p) => p.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    qc.setQueryData(["claim-damage-photos", claimId], list);
    await Promise.all(
      list.map((p, i) =>
        supabase.from("job_photos").update({ sort_order: i } as any).eq("id", p.id),
      ),
    );
    qc.invalidateQueries({ queryKey: ["claim-damage-photos", claimId] });
  }


  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      for (const f of files) {
        const path = await uploadPhoto(f, `claim-damage/${claimId}`);
        const { error } = await supabase.from("job_photos").insert({
          uploaded_by: uid,
          storage_path: path,
          caption: `${PRINT_PREFIX}${claimId} · ${f.name}`,
        } as any);
        if (error) throw error;
      }
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} uploaded`);
      qc.invalidateQueries({ queryKey: ["claim-damage-photos", claimId] });
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function deletePhoto(id: string, path: string) {
    if (!confirm("Delete this photo?")) return;
    await supabase.storage
      .from("workshop-photos")
      .remove([path])
      .catch(() => {});
    await supabase.from("job_photos").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["claim-damage-photos", claimId] });
  }

  return (
    <section className="card-surface p-4 sm:p-5 border-l-4 border-orange-500/60 print:hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500/15 text-orange-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground font-bold">
              Collision
            </div>
            <h2 className="font-display text-lg font-semibold">Damage photos</h2>
          </div>
        </div>
        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              capture="environment"
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Camera className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Add photos"}
            </Button>
          </>
        )}
      </div>

      {photos.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (photos.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No damage photos yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {(photos.data ?? []).map((p: any) => (
            <div
              key={p.id}
              className="relative group rounded-lg overflow-hidden border border-border bg-card aspect-square"
            >
              <img
                src={p.url}
                alt={p.caption ?? ""}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {canEdit && (
                <button
                  onClick={() => deletePhoto(p.id, p.storage_path)}
                  className="absolute top-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-background/80 backdrop-blur text-destructive opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
