/** Browser-only PDF export of the same styled sheet used by the print preview. */
export async function downloadDocumentPdf(doc: Document, filename: string) {
  const sheet = doc.querySelector<HTMLElement>(".invoice-sheet");
  const page = doc.querySelector<HTMLElement>(".invoice-page");
  if (!sheet || !page) throw new Error("Document is not ready");
  await doc.fonts.ready;
  await Promise.all(Array.from(sheet.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);
  const previousZoom = page.style.zoom;
  const previousMin = sheet.style.getPropertyValue("--sheetmin");
  try {
    page.style.zoom = "1";
    sheet.style.setProperty("--sheetmin", "0px");
    const rect = sheet.getBoundingClientRect();
    const width = rect.width;
    const height = Math.max(rect.height, sheet.scrollHeight);
    const protectedBlocks = Array.from(sheet.querySelectorAll<HTMLElement>(
      "table[data-invoice-items] tbody tr, [data-invoice-totals], [data-invoice-header]",
    )).filter((el) => el.getBoundingClientRect().height > 0).map((el) => {
      const box = el.getBoundingClientRect();
      return { top: box.top - rect.top, bottom: box.bottom - rect.top };
    });
    const cutsFor = (capacity: number) => {
      const cuts = [0];
      while (cuts[cuts.length - 1] + capacity < height - 1) {
        const start = cuts[cuts.length - 1];
        let end = start + capacity;
        const crossing = protectedBlocks.find((b) => b.top < end && b.bottom > end && b.top > start + 1);
        if (crossing) end = crossing.top;
        cuts.push(end);
      }
      cuts.push(height);
      return cuts;
    };
    let capacity = width * 277 / 190;
    let cuts = cutsFor(capacity);
    // Keep the standard size where possible; only long documents shrink to two A4 pages.
    for (let attempt = 0; cuts.length > 3 && attempt < 20; attempt++) {
      capacity *= 1.1;
      cuts = cutsFor(capacity);
    }
    const canvas = await html2canvas(sheet, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    pdf.setProperties({ title: filename.replace(/\.pdf$/i, ""), author: "Motorcycle Doctors" });
    const renderWidth = Math.min(190, 277 * width / capacity);
    for (let i = 0; i < cuts.length - 1; i++) {
      if (i > 0) pdf.addPage();
      const top = Math.round(cuts[i] * canvas.height / height);
      const bottom = Math.round(cuts[i + 1] * canvas.height / height);
      const slice = doc.createElement("canvas");
      slice.width = canvas.width;
      slice.height = bottom - top;
      const context = slice.getContext("2d");
      if (!context) throw new Error("Could not prepare PDF");
      context.drawImage(canvas, 0, top, canvas.width, slice.height, 0, 0, slice.width, slice.height);
      pdf.addImage(slice.toDataURL("image/png"), "PNG", 10, 10, renderWidth, slice.height / slice.width * renderWidth);
    }
    pdf.save(filename);
  } finally {
    page.style.zoom = previousZoom;
    if (previousMin) sheet.style.setProperty("--sheetmin", previousMin);
    else sheet.style.removeProperty("--sheetmin");
  }
}