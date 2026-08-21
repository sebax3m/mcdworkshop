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
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  /** Real print scale — affects the printed output, not just the on-screen preview. */
  const [printScale, setPrintScale] = useState(100);
  const [margin, setMargin] = useState<"none" | "narrow" | "normal">("none");
  /** Vertical density: 100 = normal spacing, lower = tighter gaps (no font rescaling). */
  const [density, setDensity] = useState(100);
  const [showGuides, setShowGuides] = useState(true);
  const [pages, setPages] = useState(1);

  const PAPER: Record<string, { w: string; h: string; css: string }> = {
    A4: { w: "210mm", h: "297mm", css: "A4" },
    Letter: { w: "216mm", h: "279mm", css: "Letter" },
    Legal: { w: "216mm", h: "356mm", css: "Legal" },
  };
  const MARGIN = { none: "0mm", narrow: "6mm", normal: "12mm" } as const;
  const landscape = orientation === "landscape";
  const pageW = landscape ? PAPER[paper].h : PAPER[paper].w;
  const pageH = landscape ? PAPER[paper].w : PAPER[paper].h;
  const usablePx =
    ((parseFloat(pageH) - 2 * parseFloat(MARGIN[margin])) / 25.4) * 96;

  /** Natural content height, ignoring the whole-page padding applied to the sheet. */
  const measure = () => {
    const d = frameRef.current?.contentDocument;
    const page = d?.querySelector(".invoice-page") as HTMLElement | null;
    const sheet = d?.querySelector(".invoice-sheet") as HTMLElement | null;
    if (!page) return 0;
    const prev = sheet?.style.getPropertyValue("--sheetmin") ?? "";
    sheet?.style.setProperty("--sheetmin", "0px");
    // scrollHeight is in unzoomed CSS px; multiply by the print scale.
    const h = page.scrollHeight * (printScale / 100);
    if (sheet) {
      if (prev) sheet.style.setProperty("--sheetmin", prev);
      else sheet.style.removeProperty("--sheetmin");
    }
    return h;
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
<html class="${rootClass}" style="${rootStyle.replace(/"/g, "&quot;")}; --pzoom:${zoom / 100}; --pscale:${printScale / 100}; --pdense:${density / 100}">
<head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>
${styles}
<style>
  @page { size: ${PAPER[paper].css} ${orientation}; margin: ${MARGIN[margin]}; }
  html, body { margin:0; padding:0; background:#f4f4f5; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .preview-viewport { padding: 16px 0; }
  .page-wrap { position: relative; width: ${pageW}; margin: 0 auto; }
  .invoice-page {
    width: 100%;
    margin: 0;
    zoom: var(--pscale, 1);
  }
  /* Keep the sheet exactly one page tall so the bottom-anchored blocks
     (notes + payment details + totals) stay pinned to the bottom edge,
     just like on screen and in the direct printout. */
  .invoice-page .invoice-sheet {
    width: 100% !important;
    margin: 0 !important;
    border: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    min-height: var(--sheetmin, calc((${pageH} - 2 * ${MARGIN[margin]}) / var(--pscale, 1))) !important;
    padding-block: ${margin === "none" ? "6mm" : "0mm"} !important;
    overflow: visible !important;
  }



  /* --- Vertical density: shrink gaps only, never the type size ---
     Applied ONLY when the user actually tightens the spacing, so at 100% the
     preview is byte-for-byte the same layout as the live invoice. */
${
  density === 100
    ? ""
    : `  .invoice-page td, .invoice-page th { padding-top: calc(0.25rem * var(--pdense)) !important; padding-bottom: calc(0.25rem * var(--pdense)) !important; }
  .invoice-page .space-y-5 > * + * { margin-top: calc(1.25rem * var(--pdense)) !important; }
  .invoice-page .space-y-4 > * + * { margin-top: calc(1rem * var(--pdense)) !important; }
  .invoice-page .space-y-3 > * + * { margin-top: calc(0.75rem * var(--pdense)) !important; }
  .invoice-page .space-y-2 > * + * { margin-top: calc(0.5rem * var(--pdense)) !important; }
  .invoice-page .gap-y-4 { row-gap: calc(1rem * var(--pdense)) !important; }
  .invoice-page .gap-y-2 { row-gap: calc(0.5rem * var(--pdense)) !important; }
  .invoice-page .py-4 { padding-top: calc(1rem * var(--pdense)) !important; padding-bottom: calc(1rem * var(--pdense)) !important; }
  .invoice-page .pt-4 { padding-top: calc(1rem * var(--pdense)) !important; }
  .invoice-page .pb-3 { padding-bottom: calc(0.75rem * var(--pdense)) !important; }
  .invoice-page .pt-3 { padding-top: calc(0.75rem * var(--pdense)) !important; }
  .invoice-page .mt-2 { margin-top: calc(0.5rem * var(--pdense)) !important; }
  .invoice-page .mt-3 { margin-top: calc(0.75rem * var(--pdense)) !important; }`
}

  /* The live invoice route ships its own screen-only zoom; inside the preview
     the sheet must always render at its natural size. */
  .invoice-page .invoice-sheet { zoom: 1 !important; }


  /* Only screen-only controls are dropped; everything else renders exactly as
     it does in the app so the preview equals the printout. */
  .invoice-page .no-print, .invoice-page .print\\:hidden { display:none !important; }
  .invoice-page .print-only { display:inline !important; }
  .invoice-page .print-hide-empty { display:none !important; }
  .invoice-sheet { box-shadow:none !important; border-radius:0 !important; }
  .invoice-sheet::after { display:none !important; }

  /* Page-break guides (screen only) */
  .page-guides {
    position:absolute; inset:0; pointer-events:none; display:${showGuides ? "block" : "none"};
    background: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(${usablePx}px - 2px),
      rgba(239,68,68,0.9) calc(${usablePx}px - 2px),
      rgba(239,68,68,0.9) ${usablePx}px
    );
  }

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
    .page-guides { display:none !important; }
    .page-wrap { width: calc(${pageW} - 2 * ${MARGIN[margin]}); margin:0 auto !important; }
    /* The invoice route's own print rules pull the page out of flow
       (position:absolute + full-viewport width). Inside this preview the page
       box is provided by @page, so keep the clone exactly where the preview
       shows it — this is what made the printout differ from the preview. */
    .invoice-page {
      position: static !important;
      left: auto !important; top: auto !important;
      width: 100% !important; max-width: none !important;
      margin: 0 !important; padding: 0 !important;
      visibility: visible !important;
    }
    body * { visibility: visible !important; }
  }


</style>
</head>
<body class="${bodyClass}">
  <div class="preview-viewport"><div class="page-wrap"><div class="page-guides"></div><div class="invoice-page">${getHtml()}</div></div></div>
  <script>
    (function () {
      // Rule for every invoice: the sheet always ends on a whole page boundary,
      // so notes + payment details + TOTAL stay pinned to the bottom of the
      // last page instead of floating up right after the last line item.
      var unit = ${usablePx} / (${printScale} / 100);
      function snap() {
        var s = document.querySelector('.invoice-sheet');
        if (!s) return;
        s.style.setProperty('--sheetmin', '0px');
        var pages = Math.max(1, Math.ceil((s.scrollHeight - 2) / unit));
        s.style.setProperty('--sheetmin', (pages * unit) + 'px');
      }
      snap();
      setTimeout(snap, 150);
      window.addEventListener('load', snap);
      window.addEventListener('beforeprint', snap);
    })();
  </script>
</body></html>`;


    frame.srcdoc = doc;
    const t = setTimeout(() => setPages(Math.max(1, Math.ceil(measure() / usablePx))), 300);
    return () => clearTimeout(t);
  }, [open, title, getHtml, paper, orientation, margin, printScale, density, showGuides, usablePx]);

  useEffect(() => {
    const d = frameRef.current?.contentDocument;
    if (d) d.documentElement.style.setProperty("--pzoom", String(zoom / 100));
  }, [zoom, open]);

  /** Squeeze vertical spacing (never the font size) until the invoice fits one page. */
  const fitOnePageByDensity = () => {
    const d = frameRef.current?.contentDocument;
    const page = d?.querySelector(".invoice-page") as HTMLElement | null;
    const sheet = d?.querySelector(".invoice-sheet") as HTMLElement | null;
    if (!d || !page) return;
    sheet?.style.setProperty("--sheetmin", "0px");
    let value = 100;
    for (let v = 100; v >= 30; v -= 2) {
      d.documentElement.style.setProperty("--pdense", String(v / 100));
      value = v;
      if (page.scrollHeight * (printScale / 100) <= usablePx) break;
    }
    const content = page.scrollHeight * (printScale / 100);
    setDensity(value);
    setPages(Math.max(1, Math.ceil(content / usablePx)));
    sheet?.style.removeProperty("--sheetmin");
  };




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
        <aside className="flex w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-muted/30 p-4">
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
                const pageWidthPx = (parseFloat(pageW) / 25.4) * 96 * (printScale / 100);
                setZoom(
                  Math.round(Math.min(200, Math.max(40, ((el.clientWidth - 32) / pageWidthPx) * 100))),
                );
              }}
              className="w-full rounded-md border border-border px-2 py-1 text-[0.65rem] text-muted-foreground hover:text-foreground"
            >
              Fit to width
            </button>
            <p className="text-[0.6rem] leading-snug text-muted-foreground">
              Screen only — does not change the printout.
            </p>
          </div>

          {/* Real print scale */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                Print scale
              </div>
              <span className="text-xs tabular-nums font-semibold">{printScale}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={130}
              step={1}
              value={printScale}
              onChange={(e) => setPrintScale(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex gap-1">
              {[80, 90, 100].map((s) => (
                <button
                  key={s}
                  onClick={() => setPrintScale(s)}
                  className={`flex-1 rounded-md border px-1 py-1 text-[0.65rem] ${
                    printScale === s
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPrintScale((s) => Math.max(50, s - 1))}
                className="flex-1 rounded-md border border-border px-1 py-1 text-[0.65rem] text-muted-foreground hover:text-foreground"
              >
                −1%
              </button>
              <button
                onClick={() => setPrintScale((s) => Math.min(130, s + 1))}
                className="flex-1 rounded-md border border-border px-1 py-1 text-[0.65rem] text-muted-foreground hover:text-foreground"
              >
                +1%
              </button>
            </div>
            <button
              onClick={() => {
                const contentPx = measure();
                if (!contentPx) return;
                setPrintScale(
                  Math.round(Math.min(130, Math.max(50, (usablePx / contentPx) * printScale))),
                );
              }}
              className="w-full rounded-md border border-border px-2 py-1 text-[0.65rem] text-muted-foreground hover:text-foreground"
            >
              Fit to one page (shrink type)
            </button>
          </div>

          {/* Vertical density — fits by tightening spacing, not by rescaling */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                Spacing
              </div>
              <span className="text-xs tabular-nums font-semibold">{density}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={100}
              step={2}
              value={density}
              onChange={(e) => setDensity(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <button
              onClick={fitOnePageByDensity}
              className="w-full rounded-md border border-primary/60 px-2 py-1 text-[0.65rem] font-semibold text-primary hover:bg-primary/10"
            >
              Fit to 1 page (tighten spacing)
            </button>
            <p className="text-[0.6rem] leading-snug text-muted-foreground">
              Reduces the gaps between items only — font sizes stay the same.
            </p>
          </div>

          {/* Page breaks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                Page breaks
              </div>
              <span className="text-xs tabular-nums font-semibold">
                {pages} {pages === 1 ? "page" : "pages"}
              </span>
            </div>
            <button
              onClick={() => setShowGuides((v) => !v)}
              className={`w-full rounded-md border px-2 py-1 text-[0.65rem] ${
                showGuides
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {showGuides ? "Hide split lines" : "Show split lines"}
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
            <div className="flex gap-1">
              {(["portrait", "landscape"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  className={`flex-1 rounded-md border px-1 py-1 text-[0.65rem] capitalize ${
                    orientation === o
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
              Margins
            </div>
            <div className="flex gap-1">
              {(["none", "narrow", "normal"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMargin(m)}
                  className={`flex-1 rounded-md border px-1 py-1 text-[0.65rem] capitalize ${
                    margin === m
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setPrintScale(100);
              setMargin("none");
              setOrientation("portrait");
              setPaper("A4");
              setZoom(100);
              setDensity(100);

            }}
            className="rounded-md border border-border px-2 py-1 text-[0.65rem] text-muted-foreground hover:text-foreground"
          >
            Reset defaults
          </button>



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
