/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { indexDocumentChunks } from "@/lib/mcd-tech.functions";

export const DOC_TYPES = [
  { value: "workshop_manual", label: "Workshop manual" },
  { value: "service_manual", label: "Service manual" },
  { value: "owner_manual", label: "Owner manual" },
  { value: "parts_catalogue", label: "Parts documentation" },
  { value: "technical_bulletin", label: "Technical bulletin" },
  { value: "internal_procedure", label: "Workshop procedure" },
  { value: "dyno_document", label: "Dyno documentation" },
  { value: "supplier_document", label: "Supplier document" },
] as const;

export const docTypeLabel = (v: string) =>
  DOC_TYPES.find((d) => d.value === v)?.label ?? v.replace(/_/g, " ");

export type DocChunk = { content: string; heading: string | null; page_from: number | null; page_to: number | null };

/** Split page text into retrieval-sized sections; never send whole manuals to AI. */
export function chunkPages(pages: Array<{ page: number; text: string }>, maxChars = 1400): DocChunk[] {
  const out: DocChunk[] = [];
  for (const p of pages) {
    const clean = p.text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
    if (!clean) continue;
    const paras = clean.split(/\n{2,}/);
    let buf = "";
    const flush = () => {
      const t = buf.trim();
      if (t.length > 40) {
        const firstLine = t.split("\n")[0]!.trim();
        out.push({
          content: t.slice(0, 5800),
          heading: firstLine.length <= 90 ? firstLine : null,
          page_from: p.page,
          page_to: p.page,
        });
      }
      buf = "";
    };
    for (const para of paras) {
      if ((buf + "\n\n" + para).length > maxChars) flush();
      buf += (buf ? "\n\n" : "") + para;
    }
    flush();
  }
  return out;
}

/** Extract text page-by-page in the browser so page references stay real. */
export async function extractPdfPages(file: File) {
  const pdfjs: any = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = (worker as any).default;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: Array<{ page: number; text: string }> = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(" ");
    pages.push({ page: i, text });
  }
  return { pages, pageCount: doc.numPages as number };
}

export async function uploadDocumentFile(documentId: string, file: File) {
  const path = `${documentId}/${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("workshop-docs").upload(path, file, { upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

/** Index in small batches to keep embedding requests bounded. */
export async function indexChunks(
  documentId: string,
  chunks: DocChunk[],
  onProgress?: (done: number, total: number) => void,
) {
  const BATCH = 25;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    await indexDocumentChunks({ data: { documentId, chunks: slice, startIndex: i } });
    onProgress?.(Math.min(i + BATCH, chunks.length), chunks.length);
  }
}

export async function fetchDocuments() {
  const { data, error } = await supabase
    .from("garage_documents")
    .select("*, bike_library_models(make, model, year_from, year_to)")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function documentChunkCounts(ids: string[]) {
  if (!ids.length) return {} as Record<string, number>;
  const { data } = await supabase
    .from("garage_document_chunks")
    .select("document_id")
    .in("document_id", ids);
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.document_id] = (out[r.document_id] ?? 0) + 1;
  return out;
}
