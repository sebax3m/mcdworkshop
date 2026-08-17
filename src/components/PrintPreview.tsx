import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Minus, Plus, RotateCcw, Move } from "lucide-react";

export type PrintSection = { id: string; label: string; defaultOn?: boolean };

export type PrintPage = {
  /** Outer HTML of the DOM node to print. */
  html: string;
  orientation?: "portrait" | "landscape";
  /** Fill the whole page (used for the big valve worksheet). */
  fill?: boolean;
  /** Rotate the page content by 0/90/180/270 degrees. */
  rotate?: number;
};

/** An extra page the user can switch on, optionally with variants (e.g. cylinders). */
export type OptionalPage = {
  id: string;
  label: string;
  defaultOn?: boolean;
  orientation?: "portrait" | "landscape";
  fill?: boolean;
  variantLabel?: string;
  variants?: { value: string; label: string }[];
  defaultVariant?: string;
  getHtml: (variant: string) => string;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  /** Called when the dialog opens — return the pages to render. */
  getPages: () => PrintPage[];
  sections?: PrintSection[];
  optionalPages?: OptionalPage[];
};

/** Paper sizes in mm (portrait). */
const PAPER = {
  A4: { w: 210, h: 297, css: "A4" },
  A5: { w: 148, h: 210, css: "A5" },
  A3: { w: 297, h: 420, css: "A3" },
  Letter: { w: 216, h: 279, css: "Letter" },
  Legal: { w: 216, h: 356, css: "Legal" },
} as const;
type PaperKey = keyof typeof PAPER;

const TEMPLATES = {
  classic: {
    label: "Classic (branded)",
    css: `.sheet-inner { font-family: ui-sans-serif, system-ui, sans-serif; }`,
  },
  minimal: {
    label: "Minimal (no boxes)",
    css: `.sheet-inner { font-family: ui-sans-serif, system-ui, sans-serif; letter-spacing:.01em; }
          .sheet-inner section, .sheet-inner .card-surface, .sheet-inner div, .sheet-inner table,
          .sheet-inner td, .sheet-inner th { border:0 !important; border-radius:0 !important; }
          .sheet-inner section, .sheet-inner .card-surface {
            border-bottom:1px solid #e4e4e7 !important; padding:2px 0 10px !important; margin-bottom:14px !important;
          }
          .sheet-inner h1 { font-weight:300 !important; font-size:1.6em !important; }
          .sheet-inner h2, .sheet-inner h3 { font-weight:600 !important; text-transform:uppercase; font-size:.72em !important; letter-spacing:.14em; color:#71717a !important; }
          .sheet .red-surface, .sheet .gold-surface { background:#ffffff !important; border-bottom:3px solid #b91c1c !important; }
          .sheet .red-surface *, .sheet .gold-surface * { color:#111 !important; -webkit-text-fill-color:#111 !important; }`,
  },
  compact: {
    label: "Compact (dense grid)",
    css: `.sheet-inner { font-size: 0.8em; font-family: ui-sans-serif, system-ui, sans-serif; }
          .sheet-inner * { line-height: 1.15 !important; }
          .sheet-inner section, .sheet-inner .card-surface {
            padding: 4px 6px !important; margin-bottom: 4px !important;
            border:1px solid #d4d4d8 !important; border-radius:2px !important;
          }
          .sheet-inner h1 { font-size:1.15em !important; }
          .sheet-inner h2, .sheet-inner h3 { font-size:.85em !important; margin:0 0 2px !important; }
          .sheet-inner td, .sheet-inner th { padding:2px 4px !important; }`,
  },
  bold: {
    label: "Bold lines (workshop)",
    css: `.sheet-inner { font-family: ui-sans-serif, system-ui, sans-serif; }
          .sheet-inner section, .sheet-inner .card-surface, .sheet-inner table {
            border: 2px solid #111 !important; border-radius: 0 !important; padding:8px !important;
          }
          .sheet-inner td, .sheet-inner th { border: 1px solid #111 !important; padding:4px 6px !important; }
          .sheet-inner th { background:#f4f4f5 !important; }
          .sheet-inner h1, .sheet-inner h2, .sheet-inner h3 {
            text-transform:uppercase; letter-spacing:.06em; font-weight:800 !important;
            border-bottom:2px solid #111 !important; padding-bottom:2px !important;
          }`,
  },
  mono: {
    label: "Mono ink-saver (B/W)",
    css: `.sheet-inner, .sheet-inner * { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace !important; }
          .sheet-inner { font-size:.86em; }
          .sheet .red-surface, .sheet .gold-surface { background: #ffffff !important; }
          .sheet .red-surface, .sheet .red-surface *, .sheet .gold-surface, .sheet .gold-surface * {
            color:#111 !important; -webkit-text-fill-color:#111 !important; border-color:#111 !important;
          }
          .sheet .red-surface { border-bottom: 2px solid #111 !important; }
          .sheet .red-gradient-text, .sheet .red-gradient-text * { color:#111 !important; -webkit-text-fill-color:#111 !important; }
          .sheet-inner section, .sheet-inner .card-surface { border:1px dashed #111 !important; border-radius:0 !important; }`,
  },
  blueprint: {
    label: "Blueprint (technical)",
    css: `.sheet-inner { font-family: ui-sans-serif, system-ui, sans-serif; }
          .sheet-inner, .sheet-inner * { color:#1e3a8a !important; -webkit-text-fill-color:#1e3a8a !important; }
          .sheet-inner section, .sheet-inner .card-surface, .sheet-inner table,
          .sheet-inner td, .sheet-inner th { border:1px solid #1e3a8a !important; border-radius:0 !important; }
          .sheet-inner section, .sheet-inner .card-surface { padding:8px !important; margin-bottom:8px !important; }
          .sheet-inner h1, .sheet-inner h2, .sheet-inner h3 {
            text-transform:uppercase; letter-spacing:.12em; font-weight:700 !important;
          }
          .sheet .red-surface, .sheet .gold-surface { background:#1e3a8a !important; }
          .sheet .red-surface *, .sheet .gold-surface * { color:#fff !important; -webkit-text-fill-color:#fff !important; }`,
  },
} as const;
type TemplateKey = keyof typeof TEMPLATES;


/** Remove `@media print { ... }` blocks (brace-balanced) from a CSS string. */
function stripPrintBlocks(css: string) {
  let out = "";
  let i = 0;
  while (i < css.length) {
    const at = css.toLowerCase().indexOf("@media print", i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, at);
    let j = css.indexOf("{", at);
    if (j === -1) break;
    let depth = 0;
    for (; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    i = j;
  }
  return out;
}

/**
 * Cloned page markup can carry the source component's own <style> tags, whose
 * `@media print` rules (e.g. `body * { visibility: hidden }`) would blank out
 * the other sheets when printing. Strip those blocks from embedded styles.
 */
function sanitizePageHtml(html: string) {
  return html.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (_m, css: string) => `<style>${stripPrintBlocks(css)}</style>`,
  );
}

/** CSS that turns the app's dark UI into ink-friendly white paper. */
function paperCss(margin: number) {
  return `
    :root { color-scheme: light; }
    html, body { margin:0; padding:0; background:#e5e5e5; }
    /* Screen-only: shrink the sheets so a full page (incl. landscape) is
       visible in the preview pane. Print is unaffected. */
    @media screen {
      body { padding:12px 0; }
      .sheet { zoom: var(--viewzoom, 1); }
    }
    * { box-shadow:none !important; }
    .sheet {
      background:#ffffff; color:#111111;
      margin:0 auto 12px; overflow:hidden; position:relative;
    }
    /* Page margins come from @page so the sheet matches the printer's
       printable area exactly — no browser shrink-to-fit. */
    .sheet-inner { padding:0; transform-origin: top left; }
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
    /* drag mode */
    body.dragmode .sheet-inner > *, body.dragmode [data-print-section] { cursor: move; }
    body.dragmode [data-print-section]:hover { outline: 1px dashed #b91c1c; }
    /* A page that is allowed to flow onto extra sheets keeps the same
       @page margins but grows and paginates naturally. */
    .sheet.flow { height:auto !important; max-height:none !important; overflow:visible !important; }
    .sheet.flow [data-print-section],
    .sheet.flow table tr { break-inside: avoid; page-break-inside: avoid; }
    @media print {
      html, body { background:#ffffff !important; }
      .sheet {
        margin:0 !important; box-shadow:none !important;
        overflow:hidden !important;
        break-inside: avoid; page-break-inside: avoid;
        break-after: page; page-break-after: always;
      }
      .sheet.flow {
        overflow:visible !important;
        break-inside: auto !important; page-break-inside: auto !important;
      }
      /* The trailing <script> is the real last child, so :last-child never
         matched and every document printed one extra blank page. */
      .sheet:last-of-type { break-after: auto; page-break-after: auto; }
    }


  `;
}

const DRAG_SCRIPT = `
(function(){
  var drag=null;
  // Screen-space mouse deltas must be converted to the element's own coordinate
  // space, otherwise a rotated/scaled page (valve diagram at 90/180/270deg)
  // moves along the wrong axis.
  function inverseMatrix(el){
    var host = el.closest('.sheet-inner');
    var m = { a:1, b:0, c:0, d:1 };
    if(host){
      var t = getComputedStyle(host).transform;
      if(t && t !== 'none'){
        var p = t.slice(t.indexOf('(')+1, -1).split(',').map(parseFloat);
        if(p.length >= 6){ m = { a:p[0], b:p[1], c:p[2], d:p[3] }; }
        else if(p.length === 16){ m = { a:p[0], b:p[1], c:p[4], d:p[5] }; }
      }
    }
    var det = m.a*m.d - m.b*m.c;
    if(!det) return { a:1, b:0, c:0, d:1 };
    return { a:m.d/det, b:-m.b/det, c:-m.c/det, d:m.a/det };
  }
  document.addEventListener('mousedown',function(e){
    if(!document.body.classList.contains('dragmode'))return;
    var el=e.target.closest('[data-print-section]') || e.target.closest('.sheet-inner > *');
    if(!el)return;
    e.preventDefault();
    drag={el:el,x:e.clientX,y:e.clientY,
      inv:inverseMatrix(el),
      dx:parseFloat(el.getAttribute('data-dx')||'0'),
      dy:parseFloat(el.getAttribute('data-dy')||'0')};
  });
  document.addEventListener('mousemove',function(e){
    if(!drag)return;
    var sx=e.clientX-drag.x, sy=e.clientY-drag.y, i=drag.inv;
    var lx=i.a*sx + i.c*sy, ly=i.b*sx + i.d*sy;
    var nx=drag.dx+lx, ny=drag.dy+ly;
    drag.el.setAttribute('data-dx',nx); drag.el.setAttribute('data-dy',ny);
    drag.el.style.position='relative'; drag.el.style.left=nx+'px'; drag.el.style.top=ny+'px';
  });
  document.addEventListener('mouseup',function(){drag=null;});

  window.addEventListener('message',function(ev){
    if(ev.data==='drag-on') document.body.classList.add('dragmode');
    if(ev.data==='drag-off') document.body.classList.remove('dragmode');
    if(ev.data==='drag-reset'){
      Array.prototype.forEach.call(document.querySelectorAll('[data-dx]'),function(el){
        el.removeAttribute('data-dx'); el.removeAttribute('data-dy');
        el.style.left=''; el.style.top='';
      });
    }
  });
})();
`;

export function PrintPreview({
  open,
  onOpenChange,
  title = "Print preview",
  getPages,
  sections = [],
  optionalPages = [],
}: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [basePages, setBasePages] = useState<PrintPage[]>([]);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [extraOn, setExtraOn] = useState<Record<string, boolean>>({});
  const [extraVariant, setExtraVariant] = useState<Record<string, string>>({});
  const [extraSize, setExtraSize] = useState(100);
  const [extraRotate, setExtraRotate] = useState(0);
  const [fitOnePage, setFitOnePage] = useState(true);
  const [scale, setScale] = useState(100);
  const [margin, setMargin] = useState(10);
  const [paper, setPaper] = useState<PaperKey>("A4");
  const [template, setTemplate] = useState<TemplateKey>("classic");
  const [dragMode, setDragMode] = useState(false);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBasePages(getPages());
    const init: Record<string, boolean> = {};
    for (const s of sections) if (s.defaultOn === false) init[s.id] = true;
    setHidden(init);
    const on: Record<string, boolean> = {};
    const va: Record<string, string> = {};
    for (const p of optionalPages) {
      on[p.id] = p.defaultOn ?? false;
      va[p.id] = p.defaultVariant ?? p.variants?.[0]?.value ?? "";
    }
    setExtraOn(on);
    setExtraVariant(va);
    setDragMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pages = useMemo<PrintPage[]>(() => {
    const extras = optionalPages
      .filter((p) => extraOn[p.id])
      .map((p) => ({
        html: `<div style="zoom:${extraSize / 100}">${p.getHtml(extraVariant[p.id] ?? "")}</div>`,
        orientation: p.orientation ?? "portrait",
        fill: p.fill,
        rotate: extraRotate,
      }));
    return [...basePages, ...extras];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePages, extraOn, extraVariant, extraSize, extraRotate]);

  const [srcDoc, setSrcDoc] = useState("");

  useEffect(() => {
    if (!open || pages.length === 0) return;
    // Copy the app's styles, but strip every `@media print { ... }` block from
    // inline <style> tags: page components ship their own print rules
    // (`body * { visibility: hidden }`, `font-size: 10.5px`, custom @page
    // margins) which would hijack this document and make the printout tiny or
    // blank — and they never show up in the preview, so print != preview.
    const headStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((n) => {
        if (n.tagName !== "STYLE") return n.outerHTML;
        return `<style>${stripPrintBlocks(n.textContent ?? "")}</style>`;
      })
      .join("\n");

    const hideRules = Object.entries(hidden)
      .filter(([, v]) => v)
      .map(([id]) => `[data-print-section="${id}"]{display:none !important;}`)
      .join("\n");

    const size = PAPER[paper];
    // Every sheet uses ONE portrait page size. Browsers do not reliably honour
    // per-page (named) @page orientation, and a wider landscape page makes the
    // whole document shrink-to-fit when printing. Landscape content is instead
    // rotated 90deg inside a portrait sheet, so the printout matches the
    // preview exactly on any printer.
    const cw = Math.max(20, size.w - margin * 2);
    const ch = Math.max(20, size.h - margin * 2);
    const pageCss = `@page { size: ${size.css} portrait; margin: ${margin}mm; }
       /* 0.5mm slack absorbs mm→px rounding so a full sheet never spills into
          an extra printed page (preview page count == printed page count). */
       .sheet { width:${cw}mm; height:calc(${ch}mm - 0.5mm); max-height:calc(${ch}mm - 0.5mm); }`;

    const body = pages
      .map(
        (p, i) =>
          `<div class="sheet" id="page-${i}"><div class="sheet-inner" id="inner-${i}">${sanitizePageHtml(
            p.html,
          )}</div></div>`,
      )
      .join("");

    setSrcDoc(
      `<!doctype html><html><head><meta charset="utf-8"><base href="${window.location.origin}/">${headStyles}<style>${paperCss(margin)}${TEMPLATES[template].css}${pageCss}${hideRules}</style></head><body>${body}<script>${DRAG_SCRIPT}<\/script></body></html>`,
    );
  }, [open, pages, hidden, margin, paper, template]);

  // Fit each page onto exactly one sheet once the frame content is ready.
  const fit = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    // Fit the widest sheet into the preview pane (screen only).
    doc.documentElement.style.setProperty("--viewzoom", "1");
    const frameW = frameRef.current?.clientWidth ?? 0;
    let widest = 0;
    pages.forEach((_, i) => {
      const el = doc.getElementById(`page-${i}`) as HTMLElement | null;
      if (el) widest = Math.max(widest, el.offsetWidth);
    });
    if (widest > 0 && frameW > 0) {
      doc.documentElement.style.setProperty(
        "--viewzoom",
        String(Math.min(1, (frameW - 28) / widest)),
      );
    }
    let over = false;
    pages.forEach((p, i) => {
      const sheet = doc.getElementById(`page-${i}`) as HTMLElement | null;
      const inner = doc.getElementById(`inner-${i}`) as HTMLElement | null;
      if (!sheet || !inner) return;
      // Reset any previous multi-page flow before measuring.
      sheet.classList.remove("flow");
      sheet.style.height = "";
      inner.style.transform = "";
      inner.style.width = "";
      inner.style.transformOrigin = "top left";

      const landscape = (p.orientation ?? "portrait") === "landscape" ? 90 : 0;
      const rot = ((((p.rotate ?? 0) + landscape) % 360) + 360) % 360;
      if (rot) {
        const availW = sheet.clientWidth;
        const availH = sheet.clientHeight;
        const swap = rot === 90 || rot === 270;
        // Lay the content out at the width it will have AFTER rotating.
        inner.style.width = `${swap ? availH : availW}px`;
        const w = inner.scrollWidth;
        const h = inner.scrollHeight;
        const bw = swap ? h : w;
        const bh = swap ? w : h;
        // 0.98 keeps the rotated box just inside the page box: a transformed
        // element that touches the print page edge is dropped by Chrome.
        const k = Math.min(availW / bw, availH / bh) * 0.98 * (scale / 100);
        inner.style.transformOrigin = "center center";
        inner.style.transform = `translate(${(availW - w) / 2}px, ${
          (availH - h) / 2
        }px) rotate(${rot}deg) scale(${k})`;
        return;
      }
      const availPx = sheet.clientHeight;
      const availW = sheet.clientWidth;
      const contentPx = inner.scrollHeight;
      const contentW = inner.scrollWidth;
      let k = scale / 100;
      if (p.fill && contentPx > 0) {
        k =
          Math.min(2.5, Math.min(availPx / contentPx, availW / Math.max(1, contentW))) *
          (scale / 100);
      }
      if (fitOnePage && contentPx * k > availPx) {
        k = Math.max(0.45, availPx / contentPx);
        if (contentPx * k > availPx + 2) over = true;
      }
      if (k !== 1) {
        inner.style.transform = `scale(${k})`;
        inner.style.width = `${100 / k}%`;
      }
      if (!fitOnePage && contentPx * k > availPx) {
        // Let the sheet grow: the browser paginates it onto extra pages while
        // @page keeps the same margins on every page.
        over = true;
        sheet.classList.add("flow");
        sheet.style.height = `${Math.ceil(contentPx * k)}px`;
      }

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

  // Keep drag mode in sync with the iframe.
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(dragMode ? "drag-on" : "drag-off", "*");
  }, [dragMode, srcDoc]);

  const doPrint = () => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    // Re-measure first so what prints is exactly what the preview shows.
    fit();
    w.focus();
    setTimeout(() => w.print(), 120);
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

            {optionalPages.length > 0 && (
              <div className="space-y-2">
                <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  Extra pages
                </div>
                {optionalPages.map((p) => (
                  <div key={p.id} className="space-y-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={!!extraOn[p.id]}
                        onChange={(e) => setExtraOn((o) => ({ ...o, [p.id]: e.target.checked }))}
                      />
                      {p.label}
                    </label>
                    {extraOn[p.id] && p.variants && p.variants.length > 0 && (
                      <div className="pl-6 space-y-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">{p.variantLabel ?? "Option"}</span>
                          <select
                            value={extraVariant[p.id] ?? ""}
                            onChange={(e) =>
                              setExtraVariant((v) => ({ ...v, [p.id]: e.target.value }))
                            }
                            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                          >
                            {p.variants.map((v) => (
                              <option key={v.value} value={v.value}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">Diagram size</span>
                          <div className="flex items-center gap-1">
                            <button
                              className="rounded border border-border p-1"
                              onClick={() => setExtraSize((s) => Math.max(60, s - 10))}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-10 text-center tabular-nums">{extraSize}%</span>
                            <button
                              className="rounded border border-border p-1"
                              onClick={() => setExtraSize((s) => Math.min(160, s + 10))}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-muted-foreground">Rotate</span>
                          <div className="flex items-center gap-1">
                            {[0, 90, 180, 270].map((deg) => (
                              <button
                                key={deg}
                                onClick={() => setExtraRotate(deg)}
                                className={`rounded border px-2 py-1 text-xs tabular-nums ${
                                  extraRotate === deg
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border"
                                }`}
                              >
                                {deg}°
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                Format
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Paper</span>
                <select
                  value={paper}
                  onChange={(e) => setPaper(e.target.value as PaperKey)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                >
                  {Object.keys(PAPER).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">Template</span>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as TemplateKey)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                >
                  {Object.entries(TEMPLATES).map(([k, t]) => (
                    <option key={k} value={k}>
                      {t.label}
                    </option>
                  ))}
                </select>
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
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={dragMode}
                  onChange={(e) => setDragMode(e.target.checked)}
                />
                <Move className="h-3.5 w-3.5" /> Move blocks with mouse
              </label>
              <button
                onClick={() => {
                  setScale(100);
                  setMargin(10);
                  setFitOnePage(true);
                  setPaper("A4");
                  setTemplate("classic");
                  setExtraSize(100);
                  setExtraRotate(0);
                  frameRef.current?.contentWindow?.postMessage("drag-reset", "*");
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
              onLoad={() => {
                fit();
                frameRef.current?.contentWindow?.postMessage(
                  dragMode ? "drag-on" : "drag-off",
                  "*",
                );
              }}
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
