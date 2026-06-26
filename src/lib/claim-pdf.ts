import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import bikeSideAsset from "@/assets/bike-side.png.asset.json";
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
  description: string;
  qty: number;
  unit_price: number;
};

export type ClaimPdfData = {
  claim: any;
  bikeText: string;
  marks: DamageMark[];
  items: QuoteItem[];
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


async function loadClaimPhotos(claimId: string): Promise<string[]> {
  const { data } = await supabase
    .from("job_photos")
    .select("storage_path")
    .ilike("caption", `CLAIM_DAMAGE: ${claimId}%`)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  if (!rows.length) return [];
  const { data: signed } = await supabase.storage
    .from("workshop-photos")
    .createSignedUrls(rows.map((r) => r.storage_path), 60 * 60);
  const urls = (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
  const datas = await Promise.all(urls.map(fetchAsDataUrl));
  return datas.filter(Boolean) as string[];
}

export async function buildClaimPdf(d: ClaimPdfData): Promise<Blob> {
  const { claim: c, bikeText, marks, items } = d;
  const pdf = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const pageH = 297;
  const margin = 12;
  let y = margin;

  // ---------- Header ----------
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("Motorcycle Doctors — Insurance Quote", margin, y);
  y += 6;
  pdf.setFontSize(11);
  pdf.text(`Claim ${c.claim_number}`, margin, y);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const headerRight = [
    `Insurer: ${c.insurer_name ?? "—"}`,
    `Ref: ${c.insurer_claim_ref ?? "—"}`,
    `Date: ${new Date(c.date_received ?? Date.now()).toLocaleDateString()}`,
  ];
  headerRight.forEach((t, i) => pdf.text(t, pageW - margin, y - 4 + i * 4, { align: "right" }));
  y += 3;
  pdf.setDrawColor(0);
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
  pdf.text(`Rego ${c.motorcycles?.rego ?? "—"}  ·  VIN ${c.motorcycles?.vin ?? "—"}`, margin + colW + 4, y);
  y += 8;

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

  // ---------- Damage diagrams (left / right / top) — stacked, large ----------
  const views: Array<{ key: "left" | "right" | "top"; title: string }> = [
    { key: "left", title: "Left side" },
    { key: "right", title: "Right side" },
    { key: "top", title: "Top view" },
  ];
  const sideData = await fetchAsDataUrl(bikeSideAsset.url);
  const topData = await fetchAsDataUrl(bikeTopAsset.url);

  pdf.setFontSize(8);
  pdf.setTextColor(100);
  pdf.text("DAMAGE DIAGRAM", margin, y);
  pdf.setTextColor(0);
  y += 4;

  // Global numbering across all views so legend matches diagram
  const numbered = marks.map((m, i) => ({ m, n: i + 1 }));

  const diagW = pageW - margin * 2;
  const diagH = diagW * (320 / 600);

  for (const v of views) {
    const viewItems = numbered.filter(({ m }) => normView(m.view) === v.key);
    // skip a view entirely if no marks AND we want compactness?  show all 3 so insurer can see
    if (y + diagH + 10 > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${v.title}${viewItems.length ? `  (${viewItems.length} mark${viewItems.length > 1 ? "s" : ""})` : ""}`, margin, y);
    pdf.setFont("helvetica", "normal");
    y += 2;
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.3);
    pdf.rect(margin, y, diagW, diagH);
    const data = v.key === "top" ? topData : sideData;
    if (data) {
      try {
        if (v.key === "right") {
          const flipped = await flipImage(data);
          pdf.addImage(flipped, "PNG", margin, y, diagW, diagH);
        } else {
          pdf.addImage(data, "PNG", margin, y, diagW, diagH);
        }
      } catch {}
    }
    // marks — large and obvious
    viewItems.forEach(({ m, n }) => {
      const cx = margin + m.x * diagW;
      const cy = y + m.y * diagH;
      const [r, g, b] = SEV_COLOR[m.severity];
      // white halo for contrast
      pdf.setFillColor(255, 255, 255);
      pdf.circle(cx, cy, 5.2, "F");
      // colored disc
      pdf.setFillColor(r, g, b);
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.5);
      pdf.circle(cx, cy, 4.4, "FD");
      // number
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text(String(n), cx, cy + 1.4, { align: "center" });
      pdf.setTextColor(0);
      pdf.setFont("helvetica", "normal");
      pdf.setLineWidth(0.2);
    });
    y += diagH + 4;
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

  const cols = {
    type: margin,
    desc: margin + 22,
    qty: pageW - margin - 60,
    unit: pageW - margin - 40,
    line: pageW - margin - 20,
  };
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setFillColor(240, 240, 240);
  pdf.rect(margin, y - 3, pageW - margin * 2, 5, "F");
  pdf.text("Type", cols.type + 1, y);
  pdf.text("Description", cols.desc, y);
  pdf.text("Qty/Hrs", cols.qty, y, { align: "right" });
  pdf.text("Unit $", cols.unit, y, { align: "right" });
  pdf.text("Line $", cols.line, y, { align: "right" });
  pdf.setFont("helvetica", "normal");
  y += 4;

  let subtotal = 0;
  for (const it of items) {
    const line = (Number(it.qty) || 0) * (Number(it.unit_price) || 0);
    subtotal += line;
    if (y + 5 > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFontSize(8);
    pdf.text(it.kind.toUpperCase(), cols.type + 1, y);
    const desc = pdf.splitTextToSize(it.description || "—", cols.qty - cols.desc - 2);
    pdf.text(desc, cols.desc, y);
    pdf.text(Number(it.qty).toFixed(2), cols.qty, y, { align: "right" });
    pdf.text(`$${Number(it.unit_price).toFixed(2)}`, cols.unit, y, { align: "right" });
    pdf.text(`$${line.toFixed(2)}`, cols.line, y, { align: "right" });
    y += Math.max(4, desc.length * 4);
    pdf.setDrawColor(220);
    pdf.line(margin, y - 1, pageW - margin, y - 1);
  }
  const gst = subtotal * 0.15;
  const total = subtotal + gst;
  y += 2;
  pdf.setFontSize(9);
  pdf.text("Subtotal", cols.unit, y, { align: "right" });
  pdf.text(`$${subtotal.toFixed(2)}`, cols.line, y, { align: "right" });
  y += 4;
  pdf.text("GST (15%)", cols.unit, y, { align: "right" });
  pdf.text(`$${gst.toFixed(2)}`, cols.line, y, { align: "right" });
  y += 5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("TOTAL (incl. GST)", cols.unit, y, { align: "right" });
  pdf.text(`$${total.toFixed(2)}`, cols.line, y, { align: "right" });
  pdf.setFont("helvetica", "normal");
  y += 6;

  // ---------- Photo thumbnails ----------
  const photos = await loadClaimPhotos(c.id);
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

    const perRow = 4;
    const gap = 3;
    const thumbW = (pageW - margin * 2 - gap * (perRow - 1)) / perRow;
    const thumbH = thumbW * 0.75;
    let col = 0;
    for (const dataUrl of photos) {
      if (col === 0 && y + thumbH > pageH - margin) {
        pdf.addPage();
        y = margin;
      }
      const xPos = margin + col * (thumbW + gap);
      try {
        pdf.addImage(dataUrl, "JPEG", xPos, y, thumbW, thumbH);
      } catch {
        try {
          pdf.addImage(dataUrl, "PNG", xPos, y, thumbW, thumbH);
        } catch {}
      }
      pdf.setDrawColor(0);
      pdf.rect(xPos, y, thumbW, thumbH);
      col++;
      if (col >= perRow) {
        col = 0;
        y += thumbH + gap;
      }
    }
    if (col !== 0) y += thumbH + gap;
  }

  return pdf.output("blob");
}

async function flipImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function sendClaimEmailWithPdf(d: ClaimPdfData & {
  to: string;
  subject: string;
  body: string;
}): Promise<{ shared: boolean }> {
  const blob = await buildClaimPdf(d);
  const filename = `Claim-${d.claim.claim_number}.pdf`;
  const file = new File([blob], filename, { type: "application/pdf" });

  // Try Web Share API (mobile + some desktop) — attaches the file directly
  const nav: any = navigator;
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  const href = `mailto:${d.to}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(
    d.body + `\n\n(Attach the downloaded file: ${filename})`,
  )}`;
  window.location.href = href;
  return { shared: false };
}
