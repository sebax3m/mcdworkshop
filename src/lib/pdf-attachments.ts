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
 * Prepare a PDF for email attachment:
 *  - under 24 MB  -> the PDF itself
 *  - over 24 MB   -> a zip of the PDF
 *  - zip still over 24 MB -> split into 2 zipped halves (by pages)
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
  if (minParts === 1) {
    const zipped = zipFile(`${name}.pdf`, bytes);
    if (zipped.byteLength <= MAX_ATTACHMENT_BYTES) {
      return [
        {
          file: new File([zipped as BlobPart], `${name}.zip`, { type: "application/zip" }),
          zipped: true,
        },
      ];
    }
  }

  // Split the PDF by pages and zip each part — every attachment stays a real .zip.
  for (let parts = Math.max(2, minParts); parts <= 24; parts++) {
    const chunks = await splitPdfBytes(bytes, parts);
    const zips = chunks.map((c, i) => zipFile(`${name}-part${i + 1}.pdf`, c));
    if (zips.every((z) => z.byteLength <= MAX_ATTACHMENT_BYTES)) {
      return zips.map((z, i) => ({
        file: new File([z as BlobPart], `${name}-part${i + 1}.zip`, { type: "application/zip" }),
        zipped: true,
      }));
    }
  }

  // Last resort: as many single-page zips as the document has pages.
  const { PDFDocument } = await import("pdf-lib");
  const pageCount = (await PDFDocument.load(bytes)).getPageCount();
  const chunks = await splitPdfBytes(bytes, pageCount);
  return chunks.map((c, i) => ({
    file: new File([zipFile(`${name}-part${i + 1}.pdf`, c) as BlobPart], `${name}-part${i + 1}.zip`, {
      type: "application/zip",
    }),
    zipped: true,
  }));
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
