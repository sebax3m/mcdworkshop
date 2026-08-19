import { zipSync } from "fflate";

/** Max attachment size accepted by most email providers (24 MB). */
export const MAX_ATTACHMENT_BYTES = 24 * 1024 * 1024;

export type PreparedAttachment = {
  file: File;
  /** true when the file is a zip */
  zipped: boolean;
};

function zipFile(name: string, bytes: Uint8Array): Uint8Array {
  return zipSync({ [name]: bytes }, { level: 9 });
}

/**
 * Split a PDF into `parts` page-range PDFs. Every part is a complete, valid
 * PDF on its own (no spanned-archive tricks), so each zip opens normally.
 */
async function splitPdfByPages(bytes: Uint8Array, parts: number): Promise<Uint8Array[]> {
  const { PDFDocument } = await import("pdf-lib");
  const src = await PDFDocument.load(bytes);
  const total = src.getPageCount();
  const effective = Math.min(parts, Math.max(1, total));
  const per = Math.ceil(total / effective);
  const out: Uint8Array[] = [];
  for (let i = 0; i < effective; i++) {
    const from = i * per;
    const to = Math.min(from + per, total);
    if (from >= to) break;
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(
      src,
      Array.from({ length: to - from }, (_, k) => from + k),
    );
    pages.forEach((p) => doc.addPage(p));
    out.push(await doc.save());
  }
  return out;
}

/**
 * Prepare a PDF for email attachment:
 *  - under 24 MB  -> the PDF itself
 *  - over 24 MB   -> a zip of the PDF
 *  - zip still over 24 MB (or minParts > 1) -> the PDF is split by page ranges
 *    into several standalone zips, each openable on its own.
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

  const needed = Math.max(minParts, Math.ceil(zipped.byteLength / MAX_ATTACHMENT_BYTES), 2);
  const pdfParts = await splitPdfByPages(bytes, needed);
  const count = pdfParts.length;

  if (count <= 1) {
    // Single-page PDF that can't be split further — send the one zip.
    return [
      {
        file: new File([zipped as BlobPart], `${name}.zip`, { type: "application/zip" }),
        zipped: true,
      },
    ];
  }

  return pdfParts.map((part, i) => {
    const partName = `${name}-part${i + 1}of${count}`;
    const z = zipFile(`${partName}.pdf`, part);
    return {
      file: new File([z as BlobPart], `${partName}.zip`, { type: "application/zip" }),
      zipped: true,
    };
  });
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
