/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl, getSignedUrls, uploadPhoto } from "@/lib/photos";
import { Camera, Copy, ImageIcon, MessageSquare, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const JOB_PHOTO_PREFIX = "JOBPIC";

const CATEGORIES = [
  { key: "before", label: "Before" },
  { key: "damage", label: "Damage" },
  { key: "progress", label: "In progress" },
  { key: "after", label: "After" },
  { key: "approval", label: "For approval" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

type Row = {
  id: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
  url: string;
  category: CategoryKey;
};

function parseCaption(caption: string | null): { category: CategoryKey; name: string } {
  const raw = caption ?? "";
  const m = raw.match(/^JOBPIC:([a-z_]+):\s?(.*)$/i);
  if (!m) return { category: "before", name: raw };
  const cat = (CATEGORIES.find((c) => c.key === m[1].toLowerCase())?.key ?? "before") as CategoryKey;
  return { category: cat, name: m[2] ?? "" };
}

/**
 * Photo evidence on a job card — any signed-in staff member can add photos
 * (before/damage/progress/after) and share one with the customer by text.
 */
export function JobPhotosSection({
  jobId,
  customerPhone,
  jobNumber,
}: {
  jobId: string;
  customerPhone?: string | null;
  jobNumber?: number | string | null;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<CategoryKey>("before");
  const [filter, setFilter] = useState<CategoryKey | "all">("all");
  const [lightbox, setLightbox] = useState<Row | null>(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);



  const photos = useQuery({
    queryKey: ["job-photos", jobId],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("job_photos")
        .select("id, storage_path, caption, created_at, sort_order")
        .eq("job_id", jobId)
        .ilike("caption", `${JOB_PHOTO_PREFIX}:%`)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const urls = await getSignedUrls(rows.map((r) => r.storage_path));
      return rows.map((r, i) => ({
        ...(r as any),
        url: urls[i],
        category: parseCaption(r.caption).category,
      }));
    },
  });

  const visible = useMemo(
    () => (photos.data ?? []).filter((p) => filter === "all" || p.category === filter),
    [photos.data, filter],
  );

  async function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const list = [...(photos.data ?? [])];
    const from = list.findIndex((p) => p.id === fromId);
    const to = list.findIndex((p) => p.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    qc.setQueryData(["job-photos", jobId], list);
    await Promise.all(
      list.map((p, i) =>
        supabase.from("job_photos").update({ sort_order: i } as any).eq("id", p.id),
      ),
    );
    qc.invalidateQueries({ queryKey: ["job-photos", jobId] });
  }


  async function handleFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      const desc = note.trim();
      for (const f of files) {
        const path = await uploadPhoto(f, `job/${jobId}`);
        const { error } = await supabase.from("job_photos").insert({
          job_id: jobId,
          uploaded_by: uid,
          storage_path: path,
          caption: `${JOB_PHOTO_PREFIX}:${category}: ${desc || f.name}`,
        } as any);
        if (error) throw error;
      }
      toast.success(`${files.length} photo${files.length > 1 ? "s" : ""} added`);
      setNote("");
      qc.invalidateQueries({ queryKey: ["job-photos", jobId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function saveNote(p: Row, text: string) {
    const caption = `${JOB_PHOTO_PREFIX}:${p.category}: ${text.trim()}`;
    const { error } = await supabase.from("job_photos").update({ caption }).eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditing(null);
    setLightbox((l) => (l && l.id === p.id ? { ...l, caption } : l));
    qc.invalidateQueries({ queryKey: ["job-photos", jobId] });
    toast.success("Description saved");
  }

  async function remove(p: Row) {
    if (!confirm("Delete this photo?")) return;
    await supabase.storage
      .from("workshop-photos")
      .remove([p.storage_path])
      .catch(() => {});
    await supabase.from("job_photos").delete().eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["job-photos", jobId] });
    setLightbox(null);
  }


  async function shareLink(p: Row, mode: "sms" | "copy") {
    // 7-day link so the customer can still open it after receiving the text.
    const url = await getSignedUrl(p.storage_path, 60 * 60 * 24 * 7);
    if (!url) {
      toast.error("Could not create a share link");
      return;
    }
    if (mode === "copy") {
      await navigator.clipboard.writeText(url);
      toast.success("Photo link copied");
      return;
    }
    const body = `Motorcycle Doctors${jobNumber ? ` — Job #${jobNumber}` : ""}: please review this photo and reply APPROVE to authorise the work. ${url}`;
    const phone = (customerPhone ?? "").replace(/[^\d+]/g, "");
    window.location.href = `sms:${phone}?&body=${encodeURIComponent(body)}`;
  }

  return (
    <section className="card-surface p-4 sm:p-5 print:hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-sky-500/15 text-sky-400">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground font-bold">
              Evidence
            </div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-service-light-blue">Job photos</h2>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryKey)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Photo category"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="h-3.5 w-3.5" /> Camera
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Add photos"}
          </Button>
        </div>
      </div>

      <div className="mb-3 print:hidden">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Short description for the next photo(s) — e.g. scratch on left fairing"
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
          aria-label="Photo description"
        />
      </div>


      <div className="flex flex-wrap gap-1.5 mb-3 print:hidden">
        {(["all", ...CATEGORIES.map((c) => c.key)] as const).map((k) => {
          const label = k === "all" ? "All" : CATEGORIES.find((c) => c.key === k)!.label;
          const count =
            k === "all"
              ? (photos.data ?? []).length
              : (photos.data ?? []).filter((p) => p.category === k).length;
          return (
            <button
              key={k}
              onClick={() => setFilter(k as any)}
              className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider transition ${
                filter === k
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label} {count > 0 && <span className="opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {photos.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No photos yet. Add pictures of the bike as proof of condition, damage or completed work.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {visible.map((p) => (
            <div
              key={p.id}
              draggable
              onDragStart={(e) => {
                setDragId(p.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) void reorder(dragId, p.id);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
              title="Drag to reorder · click to preview"
              className={`rounded-lg overflow-hidden border border-border bg-card print:break-inside-avoid cursor-grab active:cursor-grabbing ${
                dragId === p.id ? "opacity-50 ring-2 ring-primary" : ""
              }`}
            >

              <div className="relative group aspect-square">
                <button onClick={() => setLightbox(p)} className="block h-full w-full">
                  <img
                    src={p.url}
                    alt={parseCaption(p.caption).name || "Job photo"}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
                <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider backdrop-blur">
                  {CATEGORIES.find((c) => c.key === p.category)?.label}
                </span>
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition print:hidden">
                  <button
                    title="Text photo to customer"
                    onClick={() => void shareLink(p, "sms")}
                    className="grid h-7 w-7 place-items-center rounded-full bg-background/85 backdrop-blur text-sky-500"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </button>
                  <button
                    title="Copy photo link"
                    onClick={() => void shareLink(p, "copy")}
                    className="grid h-7 w-7 place-items-center rounded-full bg-background/85 backdrop-blur"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    title="Delete photo"
                    onClick={() => void remove(p)}
                    className="grid h-7 w-7 place-items-center rounded-full bg-background/85 backdrop-blur text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="px-2 py-1.5">
                {editing?.id === p.id ? (
                  <input
                    autoFocus
                    value={editing.text}
                    onChange={(e) => setEditing({ id: p.id, text: e.target.value })}
                    onBlur={() => void saveNote(p, editing.text)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void saveNote(p, editing.text);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="h-7 w-full rounded border border-border bg-background px-1.5 text-[0.7rem]"
                  />
                ) : (
                  <button
                    onClick={() =>
                      setEditing({ id: p.id, text: parseCaption(p.caption).name })
                    }
                    className="block w-full text-left text-[0.7rem] leading-snug text-muted-foreground hover:text-foreground line-clamp-2"
                    title="Click to edit description"
                  >
                    {parseCaption(p.caption).name || "Add description…"}
                  </button>
                )}
              </div>
            </div>
          ))}

        </div>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 print:hidden"
          onClick={() => setLightbox(null)}
        >
          <div
            className="max-h-full max-w-3xl w-full space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.url}
              alt={parseCaption(lightbox.caption).name || "Job photo"}
              className="max-h-[70vh] w-full rounded-lg object-contain bg-black"
            />
            <input
              defaultValue={parseCaption(lightbox.caption).name}
              key={lightbox.id}
              placeholder="Description of this photo"
              onBlur={(e) => void saveNote(lightbox, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveNote(lightbox, e.currentTarget.value);
              }}
              className="h-9 w-full rounded-md border border-white/20 bg-black/50 px-3 text-sm text-white placeholder:text-white/50"
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-white/80">
                {CATEGORIES.find((c) => c.key === lightbox.category)?.label} ·{" "}
                {new Date(lightbox.created_at).toLocaleString()}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void shareLink(lightbox, "sms")}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Text to customer
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => void shareLink(lightbox, "copy")}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => void remove(lightbox)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setLightbox(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default JobPhotosSection;
