import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

export async function generateClaimPdf(opts: {
  elementId: string;
  filename: string;
  email?: string;
  subject?: string;
  body?: string;
}) {
  const el = document.getElementById(opts.elementId);
  if (!el) throw new Error(`Element #${opts.elementId} not found`);

  // Temporarily make the print-only element visible off-screen for capture
  const prev = {
    display: el.style.display,
    position: el.style.position,
    left: el.style.left,
    top: el.style.top,
    width: el.style.width,
    background: el.style.background,
    color: el.style.color,
    padding: el.style.padding,
    zIndex: el.style.zIndex,
  };
  el.style.display = "block";
  el.style.position = "fixed";
  el.style.left = "-10000px";
  el.style.top = "0";
  el.style.width = "800px";
  el.style.background = "#ffffff";
  el.style.color = "#000000";
  el.style.padding = "24px";
  el.style.zIndex = "-1";

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const pageH = 297;
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    pdf.save(opts.filename);
  } finally {
    el.style.display = prev.display;
    el.style.position = prev.position;
    el.style.left = prev.left;
    el.style.top = prev.top;
    el.style.width = prev.width;
    el.style.background = prev.background;
    el.style.color = prev.color;
    el.style.padding = prev.padding;
    el.style.zIndex = prev.zIndex;
  }

  if (opts.email) {
    const href = `mailto:${opts.email}?subject=${encodeURIComponent(opts.subject ?? "")}&body=${encodeURIComponent(opts.body ?? "")}`;
    window.location.href = href;
  }
}
