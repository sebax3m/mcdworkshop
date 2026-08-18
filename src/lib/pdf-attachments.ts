import { zipSync } from "fflate";

/** Max attachment size accepted by most email providers (24 MB). */
export const MAX_ATTACHMENT_BYTES = 24 * 1024 * 1024;

export type PreparedAttachment = {
  file: File;
  /** true when the file is a zip (or a zip part) */
  zipped: boolean;
};

function zipFile(name: string, bytes: Uint8Array): Uint8Array {
  return zipSync({ [name]: bytes }, { level: 9 });
}

/** Split a PDF into N page-balanced PDFs. Returns the raw bytes of each part. */
async function splitPdfBytes(bytes: Uint8Array, parts: number): Promise<Uint8Array[]> {
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(bytes);
  const total = src.getPageCount();
  const per = Math.ceil(total / parts);
  const out: Uint8Array[] = [];
  for (let i = 0; i < total; i += per) {
    const doc = await PDFDocument.create();
    const idx = Array.from({ length: Math.min(per, total - i) }, (_, k) => i + k);
    const pages = await doc.copyPages(src, idx);
    pages.forEach((p) => doc.addPage(p));
    out.push(await doc.save());
  }
  return out;
}

/**
 * Split one zip archive into spanned volumes (WinZip/7-Zip style):
 *   Claim-1234.z01, Claim-1234.z02, … , Claim-1234.zip  (last volume)
 * The user opens the final `.zip` and the archiver rejoins every volume,
 * extracting a single PDF.
 */
function splitZipVolumes(name: string, zipped: Uint8Array, parts: number): File[] {
  const size = Math.ceil(zipped.byteLength / parts);
  const out: File[] = [];
  for (let i = 0; i < parts; i++) {
    const chunk = zipped.slice(i * size, Math.min((i + 1) * size, zipped.byteLength));
    const isLast = i === parts - 1;
    const ext = isLast ? "zip" : `z${String(i + 1).padStart(2, "0")}`;
    out.push(
      new File([chunk as BlobPart], `${name}.${ext}`, {
        type: isLast ? "application/zip" : "application/octet-stream",
      }),
    );
  }
  return out;
}

/**
 * Prepare a PDF for email attachment:
 *  - under 24 MB  -> the PDF itself
 *  - over 24 MB   -> a zip of the PDF
 *  - zip still over 24 MB -> spanned zip volumes (.z01 … .zip) of that SAME zip,
 *    so opening the final .zip restores one single PDF.
 */
export async function preparePdfAttachments(
  blob: Blob,
  baseName: string,
  opts?: { forceZip?: boolean; minParts?: number },
): Promise<PreparedAttachment[]> {
  const name = baseName.replace(/\.pdf$/i, "");
  const minParts = Math.max(1, opts?.minParts ?? 1);
  if (blob.size <= MAX_ATTACHMENT_BYTES && minParts === 1 && !opts?.forceZip) {
    return [{ file: new File([blob], `${name}.pdf`, { type: "application/pdf" }), zipped: false }];
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const zipped = zipFile(`${name}.pdf`, bytes);

  if (minParts === 1 && zipped.byteLength <= MAX_ATTACHMENT_BYTES) {
    return [
      {
        file: new File([zipped as BlobPart], `${name}.zip`, { type: "application/zip" }),
        zipped: true,
      },
    ];
  }

  const needed = Math.max(
    minParts,
    Math.ceil(zipped.byteLength / MAX_ATTACHMENT_BYTES),
    2,
  );
  return splitZipVolumes(name, zipped, needed).map((file) => ({ file, zipped: true }));
}

/** Estimated attachment layout for a PDF, without downloading anything. */
export async function estimateAttachments(
  blob: Blob,
  baseName: string,
): Promise<{ pdfSize: number; zipSize: number; parts: number; names: string[] }> {
  const prepared = await preparePdfAttachments(blob, baseName, { forceZip: true });
  return {
    pdfSize: blob.size,
    zipSize: prepared.reduce((s, p) => s + p.file.size, 0),
    parts: prepared.length,
    names: prepared.map((p) => p.file.name),
  };
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
