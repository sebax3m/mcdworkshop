import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Minus, Plus, RotateCcw } from "lucide-react";

export type PrintSection = { id: string; label: string; defaultOn?: boolean };

export type PrintPage = {
  /** Outer HTML of the DOM node to print. */
  html: string;
  orientation?: "portrait" | "landscape";
  /** Fill the whole page (used for the big valve worksheet). */
  fill?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  /** Called when the dialog opens — return the pages to render. */
  getPages: () => PrintPage[];
  sections?: PrintSection[];
};

const PAGE = {
  portrait: { w: 210, h: 297 },
  landscape: { w: 297, h: 210 },
};

/** CSS that turns the app's dark UI into ink-friendly white paper. */
function paperCss(margin: number) {
  return `
    :root { color-scheme: light; }
    html, body { margin:0; padding:0; background:#e5e5e5; }
    * { box-shadow:none !important; }
    .sheet {
      background:#ffffff; color:#111111;
      margin:0 auto 12px; overflow:hidden; position:relative;
    }
    .sheet-inner { padding:${margin}mm; transform-origin: top left; }
    .sheet, .sheet * {
      background-color: transparent !important;
      color:#111111 !important;
      border-color:#d4d4d8 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .sheet { background-color:#ffffff !important; }
    .sheet .text-muted-foreground,
    .sheet .text-muted-foreground * { color:#52525b !important; }
    /* Keep the branded header band red */
    .sheet .red-surface,
    .sheet .red-surface *,
    .sheet .gold-surface,
    .sheet .gold-surface * {
      color:#ffffff !important;
      -webkit-text-fill-color:#ffffff !important;
      border-color: rgba(255,255,255,0.35) !important;
    }
    .sheet .red-surface, .sheet .gold-surface {
      background: linear-gradient(135deg,#b91c1c,#7f1d1d) !important;
    }
    .sheet .red-gradient-text, .sheet .red-gradient-text * {
      color:#b91c1c !important; -webkit-text-fill-color:#b91c1c !important;
      background: none !important;
    }
    .sheet input, .sheet textarea, .sheet select {
      border:0 !important; background:transparent !important; resize:none !important;
      color:#111 !important; padding:0 !important;
    }
    .no-print, [data-print="hide"], .print-hide { display:none !important; }
    /* interactive chrome never prints */
    .sheet select, .sheet form.no-print { display:none !important; }
    .sheet textarea::placeholder, .sheet input::placeholder { color:transparent !important; }
    /* emulate print media inside the preview */
    .sheet .print\\:hidden { display:none !important; }
    .sheet .hidden.print\\:block { display:block !important; }
    .sheet .hidden.print\\:inline-block { display:inline-block !important; }
    .sheet .hidden.print\\:inline { display:inline !important; }
    .sheet .print\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0,1fr)) !important; }
    .sheet .print\\:border-0 { border:0 !important; }
    @media print {
      html, body { background:#ffffff !important; }
      .sheet { margin:0 !important; box-shadow:none !important; page-break-after: always; }
      .sheet:last-child { page-break-after: auto; }
    }
  `;
}

export function PrintPreview({
  open,
  onOpenChange,
  title = "Print preview",
  getPages,
  sections = [],
}: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [pages, setPages] = useState<PrintPage[]>([]);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [fitOnePage, setFitOnePage] = useState(true);
  const [scale, setScale] = useState(100);
  const [margin, setMargin] = useState(10);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPages(getPages());
    const init: Record<string, boolean> = {};
    for (const s of sections) if (s.defaultOn === false) init[s.id] = true;
    setHidden(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [srcDoc, setSrcDoc] = useState("");

  useEffect(() => {
    if (!open || pages.length === 0) return;
    const headStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((n) => n.outerHTML)
      .join("\n");

    const hideRules = Object.entries(hidden)
      .filter(([, v]) => v)
      .map(([id]) => `[data-print-section="${id}"]{display:none !important;}`)
      .join("\n");

    const pageCss = pages
      .map((p, i) => {
        const o = p.orientation ?? "portrait";
        return `@page p${i} { size: A4 ${o}; margin: 0; }
                #page-${i} { page: p${i}; width:${PAGE[o].w}mm; min-height:${PAGE[o].h}mm; }`;
      })
      .join("\n");

    const body = pages
      .map(
        (p, i) =>
          `<div class="sheet" id="page-${i}"><div class="sheet-inner" id="inner-${i}">${p.html}</div></div>`,
      )
      .join("");

    setSrcDoc(
      `<!doctype html><html><head><meta charset="utf-8"><base href="${window.location.origin}/">${headStyles}<style>${paperCss(margin)}${pageCss}${hideRules}</style></head><body>${body}</body></html>`,
    );
  }, [open, pages, hidden, margin]);

  // Fit each page onto exactly one sheet once the frame content is ready.
  const fit = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    let over = false;
    pages.forEach((p, i) => {
      const sheet = doc.getElementById(`page-${i}`) as HTMLElement | null;
      const inner = doc.getElementById(`inner-${i}`) as HTMLElement | null;
      if (!sheet || !inner) return;
      inner.style.transform = "";
      inner.style.width = "";
      const availPx = sheet.clientHeight;
      const contentPx = inner.scrollHeight;
      let k = scale / 100;
      if (p.fill && contentPx > 0) k = Math.min(2.5, (availPx / contentPx) * (scale / 100));
      if (fitOnePage && contentPx * k > availPx) {
        k = Math.max(0.45, availPx / contentPx);
        if (contentPx * k > availPx + 2) over = true;
      }
      if (k !== 1) {
        inner.style.transform = `scale(${k})`;
        inner.style.width = `${100 / k}%`;
      }
      if (!fitOnePage && contentPx * k > availPx) over = true;
    });
    setOverflow(over);
  }, [pages, scale, fitOnePage]);

  useEffect(() => {
    if (!open || !srcDoc) return;
    const t1 = setTimeout(fit, 150);
    const t2 = setTimeout(fit, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open, srcDoc, fit]);

  const doPrint = () => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4" /> {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Options */}
          <aside className="w-64 shrink-0 border-r border-border p-4 space-y-5 overflow-y-auto">
            {sections.length > 0 && (
              <div className="space-y-2">
                <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  Include sections
                </div>
                {sections.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={!hidden[s.id]}
                      onChange={(e) => setHidden((h) => ({ ...h, [s.id]: !e.target.checked }))}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                Format
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={fitOnePage}
                  onChange={(e) => setFitOnePage(e.target.checked)}
                />
                Always fit on 1 page
              </label>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Scale</span>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded border border-border p-1"
                    onClick={() => setScale((s) => Math.max(50, s - 5))}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-10 text-center tabular-nums">{scale}%</span>
                  <button
                    className="rounded border border-border p-1"
                    onClick={() => setScale((s) => Math.min(130, s + 5))}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Margin</span>
                <select
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                >
                  <option value={6}>Narrow</option>
                  <option value={10}>Normal</option>
                  <option value={16}>Wide</option>
                </select>
              </div>
              <button
                onClick={() => {
                  setScale(100);
                  setMargin(10);
                  setFitOnePage(true);
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" /> Reset format
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Paper is white to save ink — only the branded header band prints in red.
            </p>
            {overflow && (
              <p className="text-xs text-amber-500">
                Content is long — turn off some sections or lower the scale to keep it on one page.
              </p>
            )}
          </aside>

          {/* Preview */}
          <div className="flex-1 min-w-0 bg-muted/40">
            <iframe
              ref={frameRef}
              title="print-preview"
              srcDoc={srcDoc}
              onLoad={fit}
              className="w-full h-full border-0 bg-neutral-200"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button className="red-surface gap-2" onClick={doPrint}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PrintPreview;
