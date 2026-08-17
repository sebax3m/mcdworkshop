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
): Promise<PreparedAttachment[]> {
  const name = baseName.replace(/\.pdf$/i, "");
  if (blob.size <= MAX_ATTACHMENT_BYTES) {
    return [{ file: new File([blob], `${name}.pdf`, { type: "application/pdf" }), zipped: false }];
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const zipped = zipFile(`${name}.pdf`, bytes);
  if (zipped.byteLength <= MAX_ATTACHMENT_BYTES) {
    return [
      {
        file: new File([zipped as BlobPart], `${name}.zip`, { type: "application/zip" }),
        zipped: true,
      },
    ];
  }

  // Still too big: split the PDF in halves (more if needed) and zip each part.
  let parts = 2;
  for (; parts <= 8; parts++) {
    const chunks = await splitPdfBytes(bytes, parts);
    const zips = chunks.map((c, i) => zipFile(`${name}-part${i + 1}.pdf`, c));
    if (zips.every((z) => z.byteLength <= MAX_ATTACHMENT_BYTES)) {
      return zips.map((z, i) => ({
        file: new File([z as BlobPart], `${name}-part${i + 1}.zip`, { type: "application/zip" }),
        zipped: true,
      }));
    }
  }

  // Fallback: raw byte split of the zip into 2 parts.
  const half = Math.ceil(zipped.byteLength / 2);
  return [zipped.slice(0, half), zipped.slice(half)].map((z, i) => ({
    file: new File([z as BlobPart], `${name}.zip.00${i + 1}`, { type: "application/octet-stream" }),
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
