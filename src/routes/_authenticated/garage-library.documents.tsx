/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, FileText, Loader2, Plus, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VerificationBadge } from "@/components/garage/SpecMeta";
import { useCurrentUser } from "@/hooks/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import {
  DOC_TYPES,
  chunkPages,
  docTypeLabel,
  documentChunkCounts,
  extractPdfPages,
  fetchDocuments,
  indexChunks,
  uploadDocumentFile,
} from "@/lib/garage-docs";
import { GARAGE_VERIFICATIONS, modelTitle, yearLabel } from "@/lib/garage-library";

export const Route = createFileRoute("/_authenticated/garage-library/documents")({
  component: DocumentsPage,
  head: () => ({
    meta: [
      { title: "Technical Documents · MCD Garage Library" },
      {
        name: "description",
        content:
          "Workshop manuals, service manuals and technical bulletins linked to exact motorcycle models and generations.",
      },
      { property: "og:title", content: "Technical Documents · MCD Garage Library" },
      {
        property: "og:description",
        content: "Searchable workshop documentation for Motorcycle Doctors technicians.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DocumentsPage() {
  const { isAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["garage-documents"],
    queryFn: fetchDocuments,
  });
  const { data: counts = {} } = useQuery({
    queryKey: ["garage-documents", "chunks", (docs as any[]).map((d) => d.id).join(",")],
    queryFn: () => documentChunkCounts((docs as any[]).map((d) => d.id)),
    enabled: (docs as any[]).length > 0,
  });

  const filtered = (docs as any[]).filter((d) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return [d.title, d.manufacturer, d.model, d.generation, docTypeLabel(d.doc_type)]
      .filter(Boolean)
      .some((v: string) => v.toLowerCase().includes(s));
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-wide">Technical documents</h1>
          <p className="text-sm text-muted-foreground">
            Manuals and technical documentation, linked to exact model and generation. Private to the
            workshop.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/garage-library">Garage Library</Link>
          </Button>
          {isAdmin && <AddDocumentDialog onDone={() => qc.invalidateQueries({ queryKey: ["garage-documents"] })} />}
        </div>
      </div>

      <Input placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-surface p-6 text-sm text-muted-foreground text-center">
          No documents yet. Only upload documentation the workshop is authorised to use.
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((d) => (
            <div key={d.id} className="card-surface p-3 flex items-start gap-3">
              <BookOpen className="h-4 w-4 mt-1 text-sky-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{d.title}</span>
                  <span className="text-[0.6rem] font-mono uppercase tracking-wider rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                    {docTypeLabel(d.doc_type)}
                  </span>
                  <VerificationBadge value={d.verification} />
                </div>
                <div className="text-xs font-mono text-muted-foreground mt-0.5">
                  {d.manufacturer} {d.model ?? ""} · {d.generation ?? `${d.year_from ?? "?"}–${d.year_to ?? "?"}`}
                  {d.version ? ` · v${d.version}` : ""} · {d.language?.toUpperCase()}
                  {d.bike_library_models
                    ? ` · linked: ${modelTitle(d.bike_library_models)} ${yearLabel(d.bike_library_models)}`
                    : " · not linked to a library model"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {(counts as any)[d.id] ?? 0} indexed sections
                  {d.storage_path ? " · file stored" : ""}
                </div>
              </div>
              {isAdmin && (
                <div className="flex flex-col gap-1">
                  <IndexButton documentId={d.id} onDone={() => qc.invalidateQueries({ queryKey: ["garage-documents"] })} />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1"
                    onClick={async () => {
                      const { data: auth } = await supabase.auth.getUser();
                      await supabase
                        .from("garage_documents")
                        .update({
                          verification: "manufacturer_verified",
                          verified_by: auth.user?.id ?? null,
                          verified_at: new Date().toISOString(),
                        })
                        .eq("id", d.id);
                      toast.success("Document verified");
                      qc.invalidateQueries({ queryKey: ["garage-documents"] });
                    }}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> Verify
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IndexButton({ documentId, onDone }: { documentId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input
        id={`idx-${documentId}`}
        type="file"
        accept=".pdf,.txt,.md"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const chunks =
              file.type === "application/pdf" || file.name.endsWith(".pdf")
                ? chunkPages((await extractPdfPages(file)).pages)
                : chunkPages([{ page: 1, text: await file.text() }]);
            if (!chunks.length) throw new Error("No text found in this file");
            await indexChunks(documentId, chunks, (done, total) =>
              toast.loading(`Indexing ${done}/${total} sections…`, { id: `idx-${documentId}` }),
            );
            toast.success(`${chunks.length} sections indexed`, { id: `idx-${documentId}` });
            onDone();
          } catch (err: any) {
            toast.error(err?.message ?? "Indexing failed", { id: `idx-${documentId}` });
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1"
        disabled={busy}
        onClick={() => document.getElementById(`idx-${documentId}`)?.click()}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        Index text
      </Button>
    </>
  );
}

function AddDocumentDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    title: "",
    manufacturer: "",
    model: "",
    generation: "",
    year_from: "",
    year_to: "",
    engine_platform: "",
    doc_type: "workshop_manual",
    language: "en",
    version: "",
    source: "manufacturer_manual",
    verification: "unverified",
    model_id: "",
    external_url: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const { data: models = [] } = useQuery({
    queryKey: ["bike-library-models", "picker"],
    queryFn: async () =>
      (
        await supabase
          .from("bike_library_models")
          .select("id, make, model, year_from, year_to")
          .eq("is_archived", false)
          .order("make")
      ).data ?? [],
    enabled: open,
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.title.trim() || !form.manufacturer.trim()) return toast.error("Title and manufacturer required");
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("garage_documents")
        .insert({
          title: form.title,
          manufacturer: form.manufacturer,
          model: form.model || null,
          generation: form.generation || null,
          year_from: form.year_from ? Number(form.year_from) : null,
          year_to: form.year_to ? Number(form.year_to) : null,
          engine_platform: form.engine_platform || null,
          doc_type: form.doc_type,
          language: form.language || "en",
          version: form.version || null,
          source: form.source,
          verification: form.verification,
          model_id: form.model_id || null,
          external_url: form.external_url || null,
          notes: form.notes || null,
          uploaded_by: auth.user?.id ?? null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      if (file) {
        const path = await uploadDocumentFile(data.id, file);
        const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
        const parsed = isPdf ? await extractPdfPages(file) : { pages: [{ page: 1, text: await file.text() }], pageCount: 1 };
        await supabase.from("garage_documents").update({ storage_path: path, page_count: parsed.pageCount }).eq("id", data.id);
        const chunks = chunkPages(parsed.pages);
        if (chunks.length) {
          await indexChunks(data.id, chunks, (done, total) =>
            toast.loading(`Indexing ${done}/${total} sections…`, { id: "new-doc" }),
          );
          toast.success(`Document added · ${chunks.length} sections indexed`, { id: "new-doc" });
        } else {
          toast.success("Document added");
        }
      } else {
        toast.success("Document added");
      }
      setOpen(false);
      setFile(null);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save document", { id: "new-doc" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1">
          <Plus className="h-4 w-4" /> Add document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add technical document</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="S1000RR Workshop Manual" />
          </div>
          <div>
            <Label>Manufacturer</Label>
            <Input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
          </div>
          <div>
            <Label>Model</Label>
            <Input value={form.model} onChange={(e) => set("model", e.target.value)} />
          </div>
          <div>
            <Label>Generation</Label>
            <Input value={form.generation} onChange={(e) => set("generation", e.target.value)} placeholder="2019–2022" />
          </div>
          <div>
            <Label>Engine / platform</Label>
            <Input value={form.engine_platform} onChange={(e) => set("engine_platform", e.target.value)} />
          </div>
          <div>
            <Label>Year from</Label>
            <Input value={form.year_from} onChange={(e) => set("year_from", e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <Label>Year to</Label>
            <Input value={form.year_to} onChange={(e) => set("year_to", e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <Label>Document type</Label>
            <Select value={form.doc_type} onValueChange={(v) => set("doc_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Verification</Label>
            <Select value={form.verification} onValueChange={(v) => set("verification", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GARAGE_VERIFICATIONS.map((v: any) => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Language</Label>
            <Input value={form.language} onChange={(e) => set("language", e.target.value)} />
          </div>
          <div>
            <Label>Version</Label>
            <Input value={form.version} onChange={(e) => set("version", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Linked library model (exact generation)</Label>
            <Select value={form.model_id || "none"} onValueChange={(v) => set("model_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Not linked" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked</SelectItem>
                {(models as any[]).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {modelTitle(m)} · {yearLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Source / reference URL</Label>
            <Input value={form.external_url} onChange={(e) => set("external_url", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>File (PDF or text) — stored privately and indexed for retrieval</Label>
            <Input type="file" accept=".pdf,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Save document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
