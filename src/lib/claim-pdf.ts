/* eslint-disable @typescript-eslint/no-explicit-any */
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import logoAsset from "@/assets/motorcycle-doctors-logo.png.asset.json";

const COMPANY = {
  name: "Motorcycle Doctors",
  tagline: "Motorcycle Service · Repair · Insurance",
  address: "Auckland, New Zealand",
  phone: "+64 9 000 0000",
  email: "info@motorcycle-doctors.co.nz",
  web: "motorcycle-doctors.co.nz",
  gst: "GST # —",
};

export type DamageMark = {
  id: string;
  view: "left" | "right" | "top" | "side";
  x: number;
  y: number;
  severity: "minor" | "moderate" | "severe";
  label?: string;
};

export type QuoteItem = {
  kind: "part" | "labour";
  item_code?: string;
  item_name?: string;
  description: string;
  qty: number;
  unit_price: number;
};

export type ClaimPdfOptions = {
  /** include damage photos in the PDF (default true) */
  includePhotos?: boolean;
  /** max number of photos to embed (default all) */
  maxPhotos?: number;
  /** JPEG quality 0.3 - 0.95 (default 0.7) */
  photoQuality?: number;
  /** max pixel width per embedded photo (default 1000) */
  photoMaxWidth?: number;
};

export type ClaimPdfData = {
  claim: any;
  bikeText: string;
  marks: DamageMark[];
  items: QuoteItem[];
  options?: ClaimPdfOptions;
};

const SEV_COLOR: Record<DamageMark["severity"], [number, number, number]> = {
  minor: [250, 204, 21],
  moderate: [249, 115, 22],
  severe: [239, 68, 68],
};

function normView(v: DamageMark["view"]): "left" | "right" {
  // top view is no longer supported — fold legacy top/side marks into left
  if (v === "right") return "right";
  return "left";
}

async function imgDims(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 4, h: 3 });
    img.src = dataUrl;
  });
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = rej;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function compressDataUrl(dataUrl: string, maxW: number, quality: number): Promise<string> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

export async function countClaimPhotos(claimId: string): Promise<number> {
  const { count } = await supabase
    .from("job_photos")
    .select("id", { count: "exact", head: true })
    .ilike("caption", `CLAIM_DAMAGE: ${claimId}%`);
  return count ?? 0;
}

async function loadClaimPhotos(claimId: string, opts: ClaimPdfOptions): Promise<string[]> {
  const { data } = await supabase
    .from("job_photos")
    .select("storage_path")
    .ilike("caption", `CLAIM_DAMAGE: ${claimId}%`)
    .order("created_at", { ascending: false });
  let rows = data ?? [];
  if (!rows.length) return [];
  if (opts.maxPhotos != null) rows = rows.slice(0, Math.max(0, opts.maxPhotos));
  if (!rows.length) return [];
  const { data: signed } = await supabase.storage.from("workshop-photos").createSignedUrls(
    rows.map((r) => r.storage_path),
    60 * 60,
  );
  const urls = (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
  const datas = (await Promise.all(urls.map(fetchAsDataUrl))).filter(Boolean) as string[];
  const maxW = opts.photoMaxWidth ?? 1000;
  const q = opts.photoQuality ?? 0.7;
  return await Promise.all(datas.map((u) => compressDataUrl(u, maxW, q)));
}

export async function buildClaimPdf(d: ClaimPdfData): Promise<Blob> {
  const { claim: c, bikeText, marks, items } = d;
  const opts: ClaimPdfOptions = d.options ?? {};
  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const pageH = 297;
  const margin = 12;
  let y = margin;

  // ---------- Header with logo & company info ----------
  const logoData = await fetchAsDataUrl(logoAsset.url);
  const logoH = 18;
  const logoW = 18;
  if (logoData) {
    try {
      pdf.addImage(logoData, "PNG", margin, y, logoW, logoH);
    } catch {
      /* ignore */
    }
  }
  const titleX = margin + logoW + 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text(COMPANY.name, titleX, y + 6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(90);
  pdf.text(COMPANY.tagline, titleX, y + 10.5);
  pdf.text(`${COMPANY.address}  ·  ${COMPANY.phone}`, titleX, y + 14);
  pdf.text(`${COMPANY.email}  ·  ${COMPANY.web}`, titleX, y + 17);
  pdf.setTextColor(0);

  // Right-side document block
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("INSURANCE QUOTE", pageW - margin, y + 5, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Claim: ${c.claim_number}`, pageW - margin, y + 10, { align: "right" });
  pdf.text(`Insurer: ${c.insurer_name ?? "—"}`, pageW - margin, y + 13.5, { align: "right" });
  pdf.text(`Ref: ${c.insurer_claim_ref ?? "—"}`, pageW - margin, y + 17, { align: "right" });

  y += logoH + 4;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.4);
  pdf.line(margin, y, pageW - margin, y);
  y += 5;

  // ---------- Customer + Vehicle ----------
  const colW = (pageW - margin * 2 - 4) / 2;
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text("CUSTOMER", margin, y);
  pdf.text("VEHICLE", margin + colW + 4, y);
  pdf.setTextColor(0);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  y += 5;
  pdf.text(`${c.customers?.first_name ?? ""} ${c.customers?.last_name ?? ""}`, margin, y);
  pdf.text(bikeText, margin + colW + 4, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  y += 4;
  pdf.text(`${c.customers?.phone ?? "—"}  ·  ${c.customers?.email ?? "—"}`, margin, y);
  pdf.text(
    `Rego ${c.motorcycles?.rego ?? "—"}  ·  VIN ${c.motorcycles?.vin ?? "—"}`,
    margin + colW + 4,
    y,
  );
  y += 4;
  pdf.text(`Date: ${new Date(c.date_received ?? Date.now()).toLocaleDateString("en-GB")}`, margin, y);
  y += 7;

  // ---------- Damage notes ----------
  if (c.notes) {
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text("DAMAGE NOTES", margin, y);
    pdf.setTextColor(0);
    pdf.setFontSize(9);
    y += 4;
    const wrapped = pdf.splitTextToSize(c.notes, pageW - margin * 2);
    pdf.text(wrapped, margin, y);
    y += wrapped.length * 4 + 4;
  }

  // ---------- Damage legend ----------
  if (marks.length) {
    if (y + 6 + marks.length * 4 > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text("MARKS", margin, y);
    pdf.setTextColor(0);
    y += 4;
    pdf.setFontSize(9);
    marks.forEach((m, i) => {
      const [r, g, b] = SEV_COLOR[m.severity];
      pdf.setFillColor(r, g, b);
      pdf.circle(margin + 2, y - 1.2, 1.8, "F");
      pdf.text(
        `${i + 1}.  ${m.severity.toUpperCase()}  ·  ${normView(m.view)} view${m.label ? ` — ${m.label}` : ""}`,
        margin + 6,
        y,
      );
      y += 4;
    });
    y += 3;
  }

  // ---------- Quote table ----------
  if (y + 30 > pageH - margin) {
    pdf.addPage();
    y = margin;
  }
  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text("QUOTATION — PARTS & LABOUR", margin, y);
  pdf.setTextColor(0);
  y += 4;

  // Column geometry (x = left edge, w = width). Numbers are right-aligned to
  // their column's right edge so every row lines up under its header.
  const tableL = margin;
  const tableR = pageW - margin;
  const pad = 1.5;
  const colQtyW = 18;
  const colUnitW = 22;
  const colLineW = 24;
  const colTypeW = 20;
  const colDescW = tableR - tableL - colTypeW - colQtyW - colUnitW - colLineW;
  const xType = tableL;
  const xDesc = xType + colTypeW;
  const xQty = xDesc + colDescW;
  const xUnit = xQty + colQtyW;
  const xLine = xUnit + colUnitW;
  const rQty = xQty + colQtyW - pad;
  const rUnit = xUnit + colUnitW - pad;
  const rLine = xLine + colLineW - pad;
  const lineH = 3.8;
  const rowPadY = 1.6;

  const drawHeader = () => {
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.setFillColor(240, 240, 240);
    pdf.rect(tableL, y, tableR - tableL, 6, "F");
    const base = y + 4.1;
    pdf.text("Type", xType + pad, base);
    pdf.text("Description", xDesc + pad, base);
    pdf.text("Qty/Hrs", rQty, base, { align: "right" });
    pdf.text("Unit $", rUnit, base, { align: "right" });
    pdf.text("Line $", rLine, base, { align: "right" });
    pdf.setFont("helvetica", "normal");
    y += 6;
  };

  drawHeader();

  let subtotal = 0;
  for (const it of items) {
    const line = (Number(it.qty) || 0) * (Number(it.unit_price) || 0);
    subtotal += line;

    pdf.setFontSize(8);
    const descParts = [
      (it.item_code ?? "").trim() && `[${(it.item_code ?? "").trim()}]`,
      (it.item_name ?? "").trim(),
      (it.description ?? "").trim() &&
        ((it.item_name ?? "").trim() ? `— ${it.description}` : it.description),
    ]
      .filter(Boolean)
      .join(" ");
    const desc: string[] = pdf.splitTextToSize(descParts || "—", colDescW - pad * 2);
    const typeLines: string[] = pdf.splitTextToSize(it.kind.toUpperCase(), colTypeW - pad * 2);
    const rowH = Math.max(desc.length, typeLines.length) * lineH + rowPadY * 2;

    if (y + rowH > pageH - margin) {
      pdf.addPage();
      y = margin;
      drawHeader();
    }

    const base = y + rowPadY + 2.7;
    pdf.text(typeLines, xType + pad, base);
    pdf.text(desc, xDesc + pad, base);
    pdf.text(Number(it.qty).toFixed(2), rQty, base, { align: "right" });
    pdf.text(`$${Number(it.unit_price).toFixed(2)}`, rUnit, base, { align: "right" });
    pdf.text(`$${line.toFixed(2)}`, rLine, base, { align: "right" });

    y += rowH;
    pdf.setDrawColor(220);
    pdf.setLineWidth(0.2);
    pdf.line(tableL, y, tableR, y);
  }
  const gst = subtotal * 0.15;
  const total = subtotal + gst;
  if (y + 22 > pageH - margin) {
    pdf.addPage();
    y = margin;
  }
  y += 5;
  pdf.setFontSize(9);
  pdf.text("Subtotal", rUnit, y, { align: "right" });
  pdf.text(`$${subtotal.toFixed(2)}`, rLine, y, { align: "right" });
  y += 4.5;
  pdf.text("GST (15%)", rUnit, y, { align: "right" });
  pdf.text(`$${gst.toFixed(2)}`, rLine, y, { align: "right" });
  y += 2;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.3);
  pdf.line(xQty, y, tableR, y);
  y += 5.5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("TOTAL (incl. GST)", rUnit, y, { align: "right" });
  pdf.text(`$${total.toFixed(2)}`, rLine, y, { align: "right" });
  pdf.setFont("helvetica", "normal");
  y += 7;

  // ---------- Photo thumbnails ----------
  const photos = opts.includePhotos === false ? [] : await loadClaimPhotos(c.id, opts);
  if (photos.length) {
    if (y + 40 > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFontSize(8);
    pdf.setTextColor(100);
    pdf.text("DAMAGE PHOTOS", margin, y);
    pdf.setTextColor(0);
    y += 4;

    const perRow = 3;
    const gap = 4;
    const cellW = (pageW - margin * 2 - gap * (perRow - 1)) / perRow;
    const cellH = cellW * 0.75;
    let col = 0;
    for (const dataUrl of photos) {
      if (col === 0 && y + cellH > pageH - margin) {
        pdf.addPage();
        y = margin;
      }
      const xPos = margin + col * (cellW + gap);
      // fit-contain inside cell, preserve aspect
      const { w: iw, h: ih } = await imgDims(dataUrl);
      const scale = Math.min(cellW / iw, cellH / ih);
      const drawW = iw * scale;
      const drawH = ih * scale;
      const dx = xPos + (cellW - drawW) / 2;
      const dy = y + (cellH - drawH) / 2;
      // light cell background
      pdf.setFillColor(245, 245, 245);
      pdf.rect(xPos, y, cellW, cellH, "F");
      try {
        pdf.addImage(dataUrl, "JPEG", dx, dy, drawW, drawH);
      } catch {
        try {
          pdf.addImage(dataUrl, "PNG", dx, dy, drawW, drawH);
        } catch {
          /* ignore */
        }
      }
      pdf.setDrawColor(180);
      pdf.setLineWidth(0.2);
      pdf.rect(xPos, y, cellW, cellH);

      col++;
      if (col >= perRow) {
        col = 0;
        y += cellH + gap;
      }
    }
    if (col !== 0) y += cellH + gap;
  }

  return pdf.output("blob");
}


export async function sendClaimEmailWithPdf(
  d: ClaimPdfData & {
    to: string;
    subject: string;
    body: string;
  },
): Promise<{ shared: boolean }> {
  const { preparePdfAttachments, downloadFile } = await import("@/lib/pdf-attachments");
  const blob = await buildClaimPdf(d);
  const prepared = await preparePdfAttachments(blob, `Claim-${d.claim.claim_number}`);
  const files = prepared.map((p) => p.file);
  const names = files.map((f) => f.name);

  // Try Web Share API (mobile + some desktop) — attaches the file(s) directly
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files })) {
    try {
      await nav.share({
        files,
        title: d.subject,
        text: d.body,
      });
      return { shared: true };
    } catch (e: any) {
      if (e?.name === "AbortError") return { shared: true };
      // fall through to download fallback
    }
  }

  // Fallback: download + open mailto
  files.forEach((f, i) => setTimeout(() => downloadFile(f), i * 400));

  const href = `mailto:${d.to}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(
    d.body + `\n\n(Attach the downloaded file${files.length > 1 ? "s" : ""}: ${names.join(", ")})`,
  )}`;
  window.location.href = href;
  return { shared: false };
}

