import { useEffect, useRef, useState } from "react";
import { Printer, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Pixel-faithful invoice preview.
 *
 * Unlike the generic `PrintPreview`, this component does NOT restyle anything:
 * it clones the live invoice sheet into an iframe together with the app's own
 * stylesheets, so the preview (and the printout) is exactly what is rendered
 * on screen. The only extra rules are the ones the invoice's own `@media print`
 * block already applies (white paper, hidden screen-only controls).
 */
export function InvoicePrintPreview({
  open,
  onOpenChange,
  title,
  getHtml,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  getHtml: () => string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (!open) return;
    const frame = frameRef.current;
    if (!frame) return;

    // The app's stylesheets, verbatim — including the invoice route's own
    // <style> tag (React renders it in the body, hence the document query).
    const styles = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]'),
    )
      .map((n) => n.outerHTML)
      .join("\n");

    const rootClass = document.documentElement.className;
    const rootStyle = document.documentElement.getAttribute("style") ?? "";
    const bodyClass = document.body.className;

    const doc = `<!doctype html>
<html class="${rootClass}" style="${rootStyle.replace(/"/g, "&quot;")}">
<head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>
${styles}
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body { margin:0; padding:0; background:#f4f4f5; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .preview-viewport { padding: 16px 0; }
  .invoice-page { width: 210mm; margin: 0 auto; background:#ffffff; }
  /* Exactly what the invoice's print rules do, applied on screen too so the
     preview equals the printout. */
  .invoice-page .no-print, .invoice-page .print\\:hidden { display:none !important; }
  .invoice-sheet { box-shadow:none !important; border:0 !important; border-radius:0 !important; }
  .invoice-sheet::after { display:none !important; }
  .invoice-sheet .bg-background { background:#ffffff !important; }
  .invoice-sheet .border-border { border-color:#e5e7eb !important; }
  .invoice-sheet, .invoice-sheet * { color-scheme: light; }
  @media screen {
    .preview-viewport { zoom: var(--pzoom, 1); }
  }
  @media print {
    html, body { background:#ffffff; }
    .preview-viewport { padding:0 !important; zoom:1 !important; }
  }
</style>
</head>
<body class="${bodyClass}">
  <div class="preview-viewport"><div class="invoice-page">${getHtml()}</div></div>
</body></html>`;

    frame.srcdoc = doc;
  }, [open, title, getHtml]);

  useEffect(() => {
    const d = frameRef.current?.contentDocument;
    if (d) d.documentElement.style.setProperty("--pzoom", String(zoom / 100));
  }, [zoom, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2">
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setZoom((z) => Math.max(40, z - 10))}
          title="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
          {zoom}%
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setZoom((z) => Math.min(150, z + 10))}
          title="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          className="red-surface gap-2"
          onClick={() => {
            const w = frameRef.current?.contentWindow;
            if (!w) return;
            w.focus();
            w.print();
          }}
        >
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Button>
        <Button variant="outline" size="icon" onClick={() => onOpenChange(false)} title="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <iframe
        ref={frameRef}
        title={title}
        className="min-h-0 flex-1 w-full border-0 bg-neutral-200"
      />
    </div>
  );
}
