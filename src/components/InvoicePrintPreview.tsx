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
  const [paper, setPaper] = useState<"A4" | "Letter" | "Legal">("A4");

  const PAPER: Record<string, { w: string; css: string }> = {
    A4: { w: "210mm", css: "A4 portrait" },
    Letter: { w: "216mm", css: "Letter portrait" },
    Legal: { w: "216mm", css: "Legal portrait" },
  };


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
  @page { size: ${PAPER[paper].css}; margin: 0; }
  html, body { margin:0; padding:0; background:#f4f4f5; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .preview-viewport { padding: 16px 0; }
  .invoice-page { width: ${PAPER[paper].w}; margin: 0 auto; }
  /* Only screen-only controls are dropped; everything else renders exactly as
     it does in the app so the preview equals the printout. */
  .invoice-page .no-print, .invoice-page .print\\:hidden { display:none !important; }
  .invoice-page .print-only { display:inline !important; }
  .invoice-page .print-hide-empty { display:none !important; }
  .invoice-sheet { box-shadow:none !important; border-radius:0 !important; }
  .invoice-sheet::after { display:none !important; }

  @media screen {
    .preview-viewport { zoom: var(--pzoom, 1); }
  }
  @media print {
    /* Neutralise the app's ink-saving print overrides so the printout is
       byte-for-byte the same design as the preview / on-screen sheet. */
    html, body { background: var(--background) !important; }
    .invoice-sheet .bg-background { background: var(--background) !important; }
    .invoice-sheet .border-border { border-color: var(--border) !important; }
    .preview-viewport { padding:0 !important; zoom:1 !important; }
  }

</style>
</head>
<body class="${bodyClass}">
  <div class="preview-viewport"><div class="invoice-page">${getHtml()}</div></div>
</body></html>`;

    frame.srcdoc = doc;
  }, [open, title, getHtml, paper]);

  useEffect(() => {
    const d = frameRef.current?.contentDocument;
    if (d) d.documentElement.style.setProperty("--pzoom", String(zoom / 100));
  }, [zoom, open]);

  if (!open) return null;

  const print = () => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      {/* Floating preview window */}
      <div className="flex h-full w-full max-w-6xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* Left tool rail */}
        <aside className="flex w-56 shrink-0 flex-col gap-4 border-r border-border bg-muted/30 p-4">
          <div className="min-w-0">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
              Preview
            </div>
            <div className="truncate text-sm font-semibold">{title}</div>
          </div>

          <div className="space-y-2">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
              Zoom
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom((z) => Math.max(40, z - 10))}
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="flex-1 text-center text-xs tabular-nums text-muted-foreground">
                {zoom}%
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setZoom((z) => Math.min(200, z + 10))}
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
            <input
              type="range"
              min={40}
              max={200}
              step={5}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex gap-1">
              {[75, 100, 125].map((z) => (
                <button
                  key={z}
                  onClick={() => setZoom(z)}
                  className={`flex-1 rounded-md border px-1 py-1 text-[0.65rem] ${
                    zoom === z
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {z}%
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const el = frameRef.current;
                if (!el) return;
                const mm = parseFloat(PAPER[paper].w);
                const pageWidthPx = (mm / 25.4) * 96;
                setZoom(
                  Math.round(Math.min(200, Math.max(40, ((el.clientWidth - 32) / pageWidthPx) * 100))),
                );
              }}
              className="w-full rounded-md border border-border px-2 py-1 text-[0.65rem] text-muted-foreground hover:text-foreground"
            >
              Fit to width
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
              Paper size
            </div>
            <div className="flex gap-1">
              {(["A4", "Letter", "Legal"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPaper(p)}
                  className={`flex-1 rounded-md border px-1 py-1 text-[0.65rem] ${
                    paper === p
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>


          <div className="mt-auto space-y-2">
            <Button className="red-surface w-full gap-2" onClick={print}>
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" /> Close
            </Button>
            <p className="text-[0.65rem] leading-snug text-muted-foreground">
              Edit any field on the invoice behind this window — close, adjust and re-open to see
              changes.
            </p>
          </div>
        </aside>

        <iframe
          ref={frameRef}
          title={title}
          className="min-h-0 min-w-0 flex-1 border-0 bg-neutral-200"
        />
      </div>
    </div>
  );
}
