/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Printer,
  Mail,
  FileDown,
  Pencil,
  Check,
  X,
  Plus,
  Trash2,
  BookOpen,
  Search,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fullBike } from "@/lib/format";
import logoAsset from "@/assets/motorcycle-doctors-logo.png.asset.json";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PrintPreview } from "@/components/PrintPreview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const GST_RATE = 0.15;
// Amounts on the invoice are GST-inclusive. The GST line shows the embedded portion.
const LABOUR_RATE = 130;

function EditableNumber({
  value,
  onCommit,
  prefix = "",
  suffix = "",
  decimals = 2,
  className = "",
}: {
  value: number;
  onCommit: (n: number) => void | Promise<void>;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toFixed(decimals));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) setDraft(value.toFixed(decimals));
  }, [value, editing, decimals]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    setEditing(false);
    const n = Number(draft);
    if (!isNaN(n) && Math.abs(n - value) > 1e-6) onCommit(n);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(value.toFixed(decimals));
            setEditing(false);
          }
        }}
        className={`w-24 rounded-md border border-primary/60 bg-background px-2 py-1 text-right tabular-nums outline-none ${className}`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`group inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-primary/10 hover:text-foreground transition-colors tabular-nums ${className}`}
      title="Click to edit"
    >
      <span>
        {prefix}
        {value.toFixed(decimals)}
        {suffix}
      </span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 no-print" />
    </button>
  );
}

function EditableText({
  value,
  onCommit,
  className = "",
  multiline = false,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void | Promise<void>;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  useEffect(() => {
    if (!editing) return;
    if (multiline) {
      const el = areaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    } else {
      inputRef.current?.select();
    }
  }, [editing, multiline]);

  function commit() {
    setEditing(false);
    const v = multiline ? draft.replace(/\s+$/, "") : draft.trim();
    if (v !== value) onCommit(v);
    else setDraft(value);
  }

  if (editing && multiline) {
    return (
      <textarea
        ref={areaRef}
        value={draft}
        rows={3}
        onChange={(e) => {
          setDraft(e.target.value);
          e.currentTarget.style.height = "auto";
          e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
        placeholder={placeholder}
        className="w-full min-h-24 resize-y rounded-md border border-primary/60 bg-background px-2 py-1 text-sm leading-relaxed outline-none"
      />
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-md border border-primary/60 bg-background px-2 py-0.5 text-sm outline-none"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`group inline-flex items-start gap-1 text-left rounded-md px-1 -mx-1 hover:bg-primary/10 transition-colors ${
        multiline ? "w-full" : ""
      } ${className}`}
      title={multiline ? "Click to edit (Enter for new line, Esc to cancel)" : "Click to edit"}
    >
      <span className={multiline ? "whitespace-pre-wrap flex-1" : ""}>
        {value || <span className="opacity-50">{placeholder ?? "Add details…"}</span>}
      </span>
      <Pencil className="h-3 w-3 mt-1 opacity-0 group-hover:opacity-60 no-print flex-none" />
    </button>
  );
}


export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  validateSearch: (s: Record<string, unknown>): { action?: "print" | "email" } =>
    s.action === "print" || s.action === "email" ? { action: s.action } : {},
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { invoiceId } = Route.useParams();
  const { action } = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, user } = useCurrentUser();

  const invoice = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(*), motorcycles(*), jobs(job_number, title, description, odometer)")
        .eq("id", invoiceId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const parts = useQuery({
    queryKey: ["invoice-parts", invoiceId, invoice.data?.job_id],
    enabled: !!invoice.data?.job_id,
    queryFn: async () =>
      (
        await supabase
          .from("parts")
          .select("*")
          .eq("job_id", invoice.data!.job_id!)
          .order("created_at")
      ).data ?? [],
  });

  // Inventory library picker (re-used by snapshot lines AND job parts)
  const [libraryTarget, setLibraryTarget] = useState<
    { kind: "snapshot"; idx: number } | { kind: "part"; id: string } | null
  >(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const library = useQuery({
    queryKey: ["inv-detail-library"],
    queryFn: async () =>
      (await supabase.from("inventory_items").select("*").order("name")).data ?? [],
  });

  const timeEntries = useQuery({
    queryKey: ["invoice-time", invoiceId, invoice.data?.job_id],
    enabled: !!invoice.data?.job_id,
    queryFn: async () =>
      (await supabase.from("time_entries").select("minutes").eq("job_id", invoice.data!.job_id!))
        .data ?? [],
  });

  const checks = useQuery({
    queryKey: ["invoice-checks", invoiceId, invoice.data?.job_id],
    enabled: !!invoice.data?.job_id,
    queryFn: async () =>
      (
        await supabase
          .from("job_tasks")
          .select("id,label,is_done,note,sort_order")
          .eq("job_id", invoice.data!.job_id!)
          .order("sort_order")
      ).data ?? [],
  });

  const jobNotes = useQuery({
    queryKey: ["invoice-job-notes", invoiceId, invoice.data?.job_id],
    enabled: !!invoice.data?.job_id,
    queryFn: async () =>
      (
        await supabase
          .from("job_notes")
          .select("id, body, created_at")
          .eq("job_id", invoice.data!.job_id!)
          .order("created_at")
      ).data ?? [],
  });

  // Ensure every invoice carries a default $30 shop consumables line. Auto-insert
  // once per job if missing, then it behaves like any other editable part line.
  useEffect(() => {
    const jobId = invoice.data?.job_id;
    if (!jobId || !parts.data) return;
    const hasConsumables = parts.data.some((p: any) =>
      (p.name ?? "").toLowerCase().includes("consumable"),
    );
    if (hasConsumables) return;
    (async () => {
      const { error } = await supabase.from("parts").insert({
        job_id: jobId,
        name: "Shop consumables",
        quantity: 1,
        retail: 30,
        on_invoice: true,
      });
      if (error) return;
      const fresh = await supabase.from("parts").select("*").eq("job_id", jobId);
      const partsSum = (fresh.data ?? []).reduce(
        (s: number, p: any) =>
          s +
          Number(p.retail ?? 0) * Number(p.quantity ?? 1) * (1 - Number(p.discount_pct ?? 0) / 100),
        0,
      );
      const subtotal = Number(invoice.data!.labour_total) + partsSum;
      const gst = Math.round(((subtotal * GST_RATE) / (1 + GST_RATE)) * 100) / 100;
      const total = Math.round(subtotal * 100) / 100;
      await supabase
        .from("invoices")
        .update({ parts_total: partsSum, gst, total })
        .eq("id", invoiceId);
      qc.invalidateQueries({ queryKey: ["invoice-parts", invoiceId, jobId] });
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    })();
  }, [invoice.data?.job_id, parts.data, invoiceId, qc]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Handle ?action=print|email passed in from "Create & print/email" on the new-invoice page.
  const actionFiredRef = useRef(false);
  useEffect(() => {
    if (!action || actionFiredRef.current) return;
    actionFiredRef.current = true;
    const t = setTimeout(() => {
      if (action === "print") setPreviewOpen(true);
      else if (action === "email") {
        const inv: any = invoice.data;
        const customer: any = inv?.customers;
        const bike: any = inv?.motorcycles;
        if (inv) {
          const to = customer?.email ?? "";
          const name = customer ? `${customer.first_name ?? ""}`.trim() : "there";
          const subject = `Invoice ${inv.invoice_number} from Motorcycle Doctors`;
          const issuedAt = new Date(inv.created_at);
          const dueAt = new Date(issuedAt);
          dueAt.setDate(dueAt.getDate() + 14);
          const body = [
            `Hi ${name || "there"},`,
            ``,
            `Please find your invoice ${inv.invoice_number} below.`,
            ``,
            `Bike: ${bike ? fullBike(bike) : "—"}`,
            `Issued: ${issuedAt.toLocaleDateString()}`,
            `Due: ${dueAt.toLocaleDateString()}`,
            ``,
            `Labour:  $${Number(inv.labour_total).toFixed(2)}`,
            `Parts:   $${Number(inv.parts_total).toFixed(2)}`,
            `GST:     $${Number(inv.gst).toFixed(2)}`,
            `TOTAL:   $${Number(inv.total).toFixed(2)}`,
            ``,
            `View online: ${window.location.href}`,
            ``,
            `Thanks,`,
            `Motorcycle Doctors`,
          ].join("\n");
          window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
      }
      nav({ to: "/invoices/$invoiceId", params: { invoiceId }, search: {}, replace: true });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  if (invoice.isLoading)
    return (
      <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
    );
  if (!invoice.data)
    return (
      <div className="card-surface p-8 text-center text-sm text-muted-foreground">
        Invoice not found.
      </div>
    );

  const inv = invoice.data;
  const defaultHours =
    (timeEntries.data ?? []).reduce((s: number, t: any) => s + Number(t.minutes ?? 0), 0) / 60;

  function lineNet(p: any) {
    const unit = Number(p.retail ?? 0);
    const qty = Number(p.quantity ?? 1);
    const disc = Number(p.discount_pct ?? 0);
    return unit * qty * (1 - disc / 100);
  }

  async function recomputeInvoiceTotals(nextLabour?: number) {
    const labour = Number(nextLabour ?? inv.labour_total);
    const partsSum = (parts.data ?? []).reduce((s: number, p: any) => s + lineNet(p), 0);
    const subtotal = labour + partsSum; // inc GST
    const gst = Math.round(((subtotal * GST_RATE) / (1 + GST_RATE)) * 100) / 100;
    const total = Math.round(subtotal * 100) / 100;
    const { error } = await supabase
      .from("invoices")
      .update({ labour_total: labour, parts_total: partsSum, gst, total })
      .eq("id", invoiceId);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
  }

  async function updateLabour({
    qty,
    unit,
    amount,
  }: {
    qty?: number;
    unit?: number;
    amount?: number;
  }) {
    const currentLabour = Number(inv.labour_total);
    const currentUnit = LABOUR_RATE;
    const currentQty = currentLabour / currentUnit;
    let nextAmount = currentLabour;
    if (amount !== undefined) nextAmount = amount;
    else if (qty !== undefined) nextAmount = qty * (unit ?? currentUnit);
    else if (unit !== undefined) nextAmount = currentQty * unit;
    nextAmount = Math.round(nextAmount * 100) / 100;
    await recomputeInvoiceTotals(nextAmount);
  }

  async function saveSnapshotMeta(patch: Record<string, unknown>) {
    const newSnap = { ...((inv.snapshot as any) ?? {}), ...patch };
    const { error } = await supabase
      .from("invoices")
      .update({ snapshot: newSnap })
      .eq("id", invoiceId);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
  }

  async function removeLabourLine() {
    await saveSnapshotMeta({ labour_hidden: true });
    await recomputeInvoiceTotals(0);
  }

  async function restoreLabourLine() {
    await saveSnapshotMeta({ labour_hidden: false });
    await recomputeInvoiceTotals(defaultHours * LABOUR_RATE);
  }

  async function updatePart(
    id: string,
    patch: {
      quantity?: number;
      retail?: number;
      name?: string;
      supplier?: string;
      discount_pct?: number;
    },
  ) {
    const { error } = await supabase.from("parts").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshPartsTotals();
  }

  async function refreshPartsTotals() {
    await qc.invalidateQueries({ queryKey: ["invoice-parts", invoiceId, inv.job_id] });
    const fresh = await supabase.from("parts").select("*").eq("job_id", inv.job_id!);
    const partsSum = (fresh.data ?? []).reduce((s: number, p: any) => s + lineNet(p), 0);
    const subtotal = Number(inv.labour_total) + partsSum;
    const gst = Math.round(((subtotal * GST_RATE) / (1 + GST_RATE)) * 100) / 100;
    const total = Math.round(subtotal * 100) / 100;
    await supabase
      .from("invoices")
      .update({ parts_total: partsSum, gst, total })
      .eq("id", invoiceId);
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
  }

  async function addJobPart() {
    if (!inv.job_id) return;
    const { error } = await supabase.from("parts").insert({
      job_id: inv.job_id,
      name: "New item",
      quantity: 1,
      cost: 0,
      retail: 0,
      discount_pct: 0,
      added_by: user?.id,
    } as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshPartsTotals();
  }

  async function deletePart(id: string) {
    const { error } = await supabase.from("parts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshPartsTotals();
  }

  async function saveSnapshotLines(
    items: { description: string; quantity: number; unit: number; discount_pct?: number }[],
  ) {
    const partsSum = items.reduce(
      (s, l) =>
        s + Number(l.unit || 0) * Number(l.quantity || 0) * (1 - Number(l.discount_pct ?? 0) / 100),
      0,
    );
    const subtotal = partsSum; // labour stays 0 for standalone
    const gst = Math.round(((subtotal * GST_RATE) / (1 + GST_RATE)) * 100) / 100;
    const total = Math.round(subtotal * 100) / 100;
    const newSnap = { ...((inv.snapshot as any) ?? {}), line_items: items };
    const { error } = await supabase
      .from("invoices")
      .update({ snapshot: newSnap, parts_total: partsSum, gst, total })
      .eq("id", invoiceId);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
  }
  function currentSnapshotLines(): {
    description: string;
    quantity: number;
    unit: number;
    discount_pct?: number;
  }[] {
    const items = (inv.snapshot as any)?.line_items;
    return Array.isArray(items) ? items : [];
  }
  async function addSnapshotLine() {
    await saveSnapshotLines([
      ...currentSnapshotLines(),
      { description: "New item", quantity: 1, unit: 0, discount_pct: 0 },
    ]);
  }
  async function updateSnapshotLine(
    idx: number,
    patch: Partial<{ description: string; quantity: number; unit: number; discount_pct: number }>,
  ) {
    const items = currentSnapshotLines().map((it, i) => (i === idx ? { ...it, ...patch } : it));
    await saveSnapshotLines(items);
  }
  async function removeSnapshotLine(idx: number) {
    await saveSnapshotLines(currentSnapshotLines().filter((_, i) => i !== idx));
  }
  const customer = inv.customers;
  const bike = inv.motorcycles;
  const issuedAt = new Date(inv.created_at);
  const dueAt = new Date(issuedAt);
  dueAt.setDate(dueAt.getDate() + 14);
  const subtotalInc = Number(inv.labour_total) + Number(inv.parts_total);
  const subtotalEx = subtotalInc / (1 + GST_RATE);

  function emailInvoice() {
    const to = customer?.email ?? "";
    const name = customer ? `${customer.first_name ?? ""}`.trim() : "there";
    const subject = `Invoice ${inv.invoice_number} from Motorcycle Doctors`;
    const body = [
      `Hi ${name || "there"},`,
      ``,
      `Please find your invoice ${inv.invoice_number} below.`,
      ``,
      `Bike: ${bike ? fullBike(bike as any) : "—"}`,
      `Issued: ${issuedAt.toLocaleDateString()}`,
      `Due: ${dueAt.toLocaleDateString()}`,
      ``,
      `Labour:  $${Number(inv.labour_total).toFixed(2)}`,
      `Parts:   $${Number(inv.parts_total).toFixed(2)}`,
      `GST:     $${Number(inv.gst).toFixed(2)}`,
      `TOTAL:   $${Number(inv.total).toFixed(2)}`,
      ``,
      `View online: ${window.location.href}`,
      ``,
      `Thanks,`,
      `Motorcycle Doctors`,
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  const canDelete = isAdmin && (inv.status ?? "").toLowerCase() === "draft";

  // Disc % column only appears when at least one line has a discount.
  const snapshotItems: any[] = Array.isArray((inv.snapshot as any)?.line_items)
    ? (inv.snapshot as any).line_items
    : [];
  const hasDiscount = inv.job_id
    ? (parts.data ?? []).some((p: any) => Number(p.discount_pct ?? 0) > 0)
    : snapshotItems.some((it) => Number(it?.discount_pct ?? 0) > 0);

  async function deleteInvoice() {
    const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invoice deleted");
    qc.invalidateQueries({ queryKey: ["invoices"] });
    nav({ to: "/invoices" });
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto invoice-page">
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          html, body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * { visibility: hidden !important; }
          .invoice-page, .invoice-page * { visibility: visible !important; }
          .invoice-page {
            position: absolute; left: 0; top: 0;
            width: 100%; max-width: none; margin: 0; padding: 0;
            font-size: 11px;
          }
          .invoice-sheet {
            box-shadow: none !important;
            border: none !important;
            page-break-inside: avoid;
          }
          /* Keep the red banner exactly like it looks in the app */
          .invoice-sheet .red-surface,
          .invoice-sheet .red-surface * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: #ffffff !important;
            -webkit-text-fill-color: #ffffff !important;
          }
          .invoice-sheet .red-surface {
            background: linear-gradient(135deg, #b91c1c, #7f1d1d) !important;
          }
          /* Tighten spacing so it fits on one page */
          .invoice-sheet .p-8 { padding: 14px 18px !important; }
          .invoice-sheet .px-8 { padding-left: 18px !important; padding-right: 18px !important; }
          .invoice-sheet .py-6 { padding-top: 12px !important; padding-bottom: 12px !important; }
          .invoice-sheet .space-y-7 > * + * { margin-top: 10px !important; }
          .invoice-sheet .space-y-5 > * + * { margin-top: 8px !important; }
          .invoice-sheet .gap-6 { gap: 12px !important; }
          .invoice-sheet .pt-5 { padding-top: 8px !important; }
          .invoice-sheet .mt-6, .invoice-sheet .mt-8 { margin-top: 10px !important; }
          .invoice-sheet h1, .invoice-sheet h2, .invoice-sheet h3 { margin: 0 !important; }
          .invoice-sheet table { font-size: 10.5px !important; }
          .invoice-sheet th, .invoice-sheet td { padding: 4px 6px !important; }
          .invoice-sheet img { max-height: 44px !important; }
          .no-print, .print\\:hidden { display: none !important; }
        }
      `}</style>

      <header className="flex items-center gap-3 print:hidden">
        <button
          onClick={() => nav({ to: "/invoices" })}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Invoice</div>
          <h1 className="font-display text-xl sm:text-2xl font-bold truncate">
            {inv.invoice_number}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            onClick={emailInvoice}
            variant="outline"
            className="gap-2"
            disabled={!customer?.email}
            title={customer?.email ? `Email to ${customer.email}` : "No email on customer"}
          >
            <Mail className="h-4 w-4" /> Email
          </Button>
          <Button onClick={() => setPreviewOpen(true)} variant="outline" className="gap-2">
            <FileDown className="h-4 w-4" /> Save PDF
          </Button>
          <Button onClick={() => setPreviewOpen(true)} className="red-surface gap-2">
            <Printer className="h-4 w-4" /> Preview & print
          </Button>
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete invoice {inv.invoice_number}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the draft invoice. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteInvoice}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <div ref={sheetRef} className="card-surface invoice-sheet overflow-hidden">
        {/* Gold banner */}
        <div className="red-surface px-8 py-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <img
              src={logoAsset.url}
              alt="Motorcycle Doctors"
              className="h-14 w-14 rounded-md object-contain bg-black/10 p-1"
            />
            <div>
              <div className="font-display text-3xl font-black tracking-tight">
                Motorcycle Doctors
              </div>
              <div className="text-xs uppercase tracking-[0.3em] opacity-80 mt-1">
                Premium Motorcycle Workshop
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[0.625rem] uppercase tracking-[0.25em] opacity-80">
              Tax Invoice
            </div>
            <div className="font-display text-2xl font-black">{inv.invoice_number}</div>
          </div>
        </div>

        <div className="p-8 space-y-7">
          {/* Meta strip */}
          <div data-print-section="meta" className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                Issued
              </div>
              <div className="font-semibold">{issuedAt.toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                Due
              </div>
              <div className="font-semibold">{dueAt.toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                Status
              </div>
              <div className="font-semibold uppercase">{inv.status}</div>
            </div>
            <div>
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                Job
              </div>
              <div className="font-semibold">{inv.jobs ? `#${inv.jobs.job_number}` : "—"}</div>
            </div>
          </div>

          {/* Bill to + Bike */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5 border-t border-border">
            <div>
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground mb-2">
                Bill To
              </div>
              <div className="font-display text-lg font-bold">
                {customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : "—"}
              </div>
              {customer?.email && (
                <div className="text-sm text-muted-foreground">{customer.email}</div>
              )}
              {customer?.phone && (
                <div className="text-sm text-muted-foreground">{customer.phone}</div>
              )}
            </div>
            <div>
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground mb-2">
                Motorcycle
              </div>
              <div className="font-display text-lg font-bold">
                {bike ? fullBike(bike as any) : "—"}
              </div>
              {bike?.rego && <div className="text-sm text-muted-foreground">Rego: {bike.rego}</div>}
              {(inv.jobs?.odometer ?? bike?.mileage) != null && (
                <div className="text-sm text-muted-foreground">
                  Odometer: {Number(inv.jobs?.odometer ?? bike?.mileage).toLocaleString()} km
                </div>
              )}
            </div>
          </div>

          {/* Service checks */}
          <div data-print-section="checks">
            <ServiceChecks
              jobId={inv.job_id}
              title={inv.jobs?.title ?? null}
              items={checks.data ?? []}
              onChanged={() =>
                qc.invalidateQueries({ queryKey: ["invoice-checks", invoiceId, inv.job_id] })
              }
              details={String((inv.snapshot as any)?.work_details ?? "")}
              onSaveDetails={(v) => saveSnapshotMeta({ work_details: v })}
            />
          </div>

          {/* Line items */}
          <div className="pt-5 border-t border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.625rem] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2.5">Description</th>
                  <th className="py-2.5 text-right w-16">Qty</th>
                  <th className="py-2.5 text-right w-24">Unit</th>
                  {hasDiscount && <th className="py-2.5 text-right w-20">Disc %</th>}
                  <th className="py-2.5 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.job_id &&
                  !(inv.snapshot as any)?.labour_hidden &&
                  (() => {
                    const rate = LABOUR_RATE;
                    const hours = Number(inv.labour_total) / rate;
                    const delta = hours - defaultHours;
                    const snap = (inv.snapshot as any) ?? {};
                    const title = snap.labour_title ?? "Workshop labour";
                    const desc =
                      snap.labour_desc ?? `Diagnostics, service & repair · $${rate}/hr (incl. GST)`;
                    const deltaLabel =
                      Math.abs(delta) < 0.01
                        ? null
                        : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}h vs tracked`;
                    return (
                      <tr className="border-b border-border/40 group">
                        <td className="py-3">
                          <EditableText
                            value={title}
                            onCommit={(v) =>
                              saveSnapshotMeta({ labour_title: v || "Workshop labour" })
                            }
                            className="font-medium"
                          />
                          <div className="text-xs text-muted-foreground">
                            <EditableText
                              value={desc}
                              multiline
                              placeholder="Describe the work performed…"
                              onCommit={(v) => saveSnapshotMeta({ labour_desc: v })}
                              className="text-xs text-muted-foreground"
                            />

                            {defaultHours > 0 && (
                              <span className="no-print">
                                {" "}
                                · tracked {defaultHours.toFixed(2)}h
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <EditableNumber
                            value={hours}
                            onCommit={(n) => updateLabour({ qty: n })}
                            suffix="h"
                          />
                          {deltaLabel && (
                            <div
                              className={`text-[0.625rem] mt-0.5 no-print ${delta > 0 ? "text-amber-500" : "text-emerald-500"}`}
                            >
                              {deltaLabel}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <EditableNumber
                            value={rate}
                            onCommit={(n) => updateLabour({ unit: n })}
                            prefix="$"
                          />
                        </td>
                        {hasDiscount && (
                          <td className="py-3 text-right text-muted-foreground">—</td>
                        )}
                        <td className="py-3 text-right font-semibold">
                          <EditableNumber
                            value={Number(inv.labour_total)}
                            onCommit={(n) => updateLabour({ amount: n })}
                            prefix="$"
                          />
                          <button
                            onClick={removeLabourLine}
                            className="ml-2 no-print opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            title="Remove labour line"
                          >
                            <Trash2 className="h-3.5 w-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })()}
                {inv.job_id &&
                  (parts.data ?? []).map((p: any) => {
                    const unit = Number(p.retail ?? 0);
                    const qty = Number(p.quantity ?? 1);
                    const disc = Number(p.discount_pct ?? 0);
                    const gross = unit * qty;
                    const net = gross * (1 - disc / 100);
                    return (
                      <tr key={p.id} className="border-b border-border/40 group">
                        <td className="py-3">
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <EditableText
                                value={p.name ?? ""}
                                onCommit={(v) => updatePart(p.id, { name: v })}
                                className="font-medium"
                              />
                              <EditableText
                                value={p.supplier ?? ""}
                                onCommit={(v) => updatePart(p.id, { supplier: v })}
                                className="text-xs text-muted-foreground block"
                              />
                            </div>
                            <button
                              onClick={() => {
                                setLibrarySearch("");
                                setLibraryTarget({ kind: "part", id: p.id });
                              }}
                              className="no-print shrink-0 rounded border border-border p-1 text-muted-foreground hover:text-foreground hover:border-primary"
                              title="Pick from inventory library"
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <EditableNumber
                            value={qty}
                            decimals={0}
                            onCommit={(n) => updatePart(p.id, { quantity: n })}
                          />
                        </td>
                        <td className="py-3 text-right">
                          <EditableNumber
                            value={unit}
                            prefix="$"
                            onCommit={(n) => updatePart(p.id, { retail: n })}
                          />
                          {!hasDiscount && (
                            <button
                              onClick={() => updatePart(p.id, { discount_pct: 10 })}
                              className="no-print block ml-auto mt-0.5 text-[0.625rem] text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100"
                              title="Add a discount on this line"
                            >
                              + Disc
                            </button>
                          )}
                        </td>
                        {hasDiscount && (
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <EditableNumber
                                value={disc}
                                suffix="%"
                                onCommit={(n) =>
                                  updatePart(p.id, { discount_pct: Math.max(0, Math.min(100, n)) })
                                }
                                className={disc > 0 ? "text-emerald-500 font-semibold" : ""}
                              />
                              {disc > 0 && (
                                <button
                                  onClick={() => updatePart(p.id, { discount_pct: 0 })}
                                  className="no-print text-muted-foreground hover:text-destructive"
                                  title="Remove discount"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="py-3 text-right font-semibold">
                          {disc > 0 && (
                            <div className="text-[0.625rem] text-muted-foreground line-through tabular-nums">
                              ${gross.toFixed(2)}
                            </div>
                          )}
                          <span className="tabular-nums">${net.toFixed(2)}</span>
                          {disc > 0 && (
                            <div className="text-[0.625rem] text-emerald-500 font-semibold">
                              −${(gross - net).toFixed(2)} ({disc}% off)
                            </div>
                          )}
                          <button
                            onClick={() => deletePart(p.id)}
                            className="ml-2 no-print opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            title="Remove line"
                          >
                            <Trash2 className="h-3.5 w-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {inv.job_id && (
                  <tr className="no-print">
                    <td colSpan={hasDiscount ? 5 : 4} className="pt-2">
                      <button
                        onClick={addJobPart}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Add line item
                      </button>
                      {(inv.snapshot as any)?.labour_hidden && (
                        <button
                          onClick={restoreLabourLine}
                          className="ml-4 text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add workshop labour
                        </button>
                      )}
                    </td>
                  </tr>
                )}
                {!inv.job_id &&
                  (() => {
                    const items: {
                      description: string;
                      quantity: number;
                      unit: number;
                      discount_pct?: number;
                    }[] = Array.isArray((inv.snapshot as any)?.line_items)
                      ? (inv.snapshot as any).line_items
                      : [];
                    if (items.length === 0) {
                      return (
                        <tr>
                          <td
                            colSpan={hasDiscount ? 5 : 4}
                            className="py-6 text-center text-xs text-muted-foreground"
                          >
                            No line items.{" "}
                            <button
                              onClick={() => addSnapshotLine()}
                              className="text-primary underline no-print"
                            >
                              Add one
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    return items.map((it, idx) => {
                      const disc = Number(it.discount_pct ?? 0);
                      const gross = Number(it.unit) * Number(it.quantity);
                      const net = gross * (1 - disc / 100);
                      return (
                        <tr key={idx} className="border-b border-border/40 group">
                          <td className="py-3">
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <EditableText
                                  value={it.description}
                                  onCommit={(v) => updateSnapshotLine(idx, { description: v })}
                                  className="font-medium"
                                />
                              </div>
                              <button
                                onClick={() => {
                                  setLibrarySearch("");
                                  setLibraryTarget({ kind: "snapshot", idx });
                                }}
                                className="no-print shrink-0 rounded border border-border p-1 text-muted-foreground hover:text-foreground hover:border-primary"
                                title="Pick from inventory library"
                              >
                                <BookOpen className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 text-right">
                            <EditableNumber
                              value={Number(it.quantity)}
                              decimals={0}
                              onCommit={(n) => updateSnapshotLine(idx, { quantity: n })}
                            />
                          </td>
                          <td className="py-3 text-right">
                            <EditableNumber
                              value={Number(it.unit)}
                              prefix="$"
                              onCommit={(n) => updateSnapshotLine(idx, { unit: n })}
                            />
                            {!hasDiscount && (
                              <button
                                onClick={() => updateSnapshotLine(idx, { discount_pct: 10 })}
                                className="no-print block ml-auto mt-0.5 text-[0.625rem] text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100"
                                title="Add a discount on this line"
                              >
                                + Disc
                              </button>
                            )}
                          </td>
                          {hasDiscount && (
                            <td className="py-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                <EditableNumber
                                  value={disc}
                                  suffix="%"
                                  onCommit={(n) =>
                                    updateSnapshotLine(idx, {
                                      discount_pct: Math.max(0, Math.min(100, n)),
                                    })
                                  }
                                  className={disc > 0 ? "text-emerald-500 font-semibold" : ""}
                                />
                                {disc > 0 && (
                                  <button
                                    onClick={() => updateSnapshotLine(idx, { discount_pct: 0 })}
                                    className="no-print text-muted-foreground hover:text-destructive"
                                    title="Remove discount"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="py-3 text-right font-semibold">
                            {disc > 0 && (
                              <div className="text-[0.625rem] text-muted-foreground line-through tabular-nums">
                                ${gross.toFixed(2)}
                              </div>
                            )}
                            <span className="tabular-nums">${net.toFixed(2)}</span>
                            {disc > 0 && (
                              <div className="text-[0.625rem] text-emerald-500 font-semibold">
                                −${(gross - net).toFixed(2)} ({disc}% off)
                              </div>
                            )}
                            <button
                              onClick={() => removeSnapshotLine(idx)}
                              className="ml-2 no-print opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                              title="Remove line"
                            >
                              <Trash2 className="h-3.5 w-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                {!inv.job_id && (
                  <tr className="no-print">
                    <td colSpan={hasDiscount ? 5 : 4} className="pt-2">
                      <button
                        onClick={() => addSnapshotLine()}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Add line item
                      </button>
                    </td>
                  </tr>
                )}
                {inv.job_id &&
                  Number(inv.labour_total) === 0 &&
                  (parts.data ?? []).length === 0 && (
                    <tr>
                      <td
                        colSpan={hasDiscount ? 5 : 4}
                        className="py-6 text-center text-xs text-muted-foreground"
                      >
                        No line items
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>

          {/* Notes + Totals */}
          <div className="pt-5 border-t border-border grid grid-cols-1 sm:grid-cols-[1fr_18rem] gap-6">
            <div data-print-section="notes">
              <NotesBox
                invoiceId={invoiceId}
                initial={inv.notes ?? ""}
                jobNotes={jobNotes.data ?? []}
                onSaved={() => qc.invalidateQueries({ queryKey: ["invoice", invoiceId] })}
              />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Labour (incl GST)</span>
                <span className="tabular-nums">${Number(inv.labour_total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parts (incl GST)</span>
                <span className="tabular-nums">${Number(inv.parts_total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-border">
                <span className="text-muted-foreground">Subtotal (excl GST)</span>
                <span className="tabular-nums">${subtotalEx.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GST 15% (incl. in above)</span>
                <span className="tabular-nums">${Number(inv.gst).toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3 mt-1 border-t-2 border-foreground/80 font-display text-xl font-black">
                <span>TOTAL</span>
                <span className="red-gradient-text tabular-nums">
                  ${Number(inv.total).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment info */}
          <div data-print-section="payment" className="pt-5 border-t border-border text-sm">
            <div>
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground mb-2">
                Payment Details
              </div>
              <div className="space-y-0.5 text-xs">
                <div>
                  <span className="text-muted-foreground">Account:</span> Motorcycle Doctors
                </div>
                <div>
                  <span className="text-muted-foreground">BSB:</span> 000-000
                </div>
                <div>
                  <span className="text-muted-foreground">Account #:</span> 0000 0000
                </div>
                <div>
                  <span className="text-muted-foreground">Reference:</span> {inv.invoice_number}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            data-print-section="footer"
            className="pt-5 border-t border-border text-center text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground"
          >
            Motorcycle Doctors · Workshop OS · Thank you for your business
          </div>
        </div>
      </div>

      {inv.job_id && (
        <div className="print:hidden text-center">
          <Link
            to="/jobs/$jobId"
            params={{ jobId: inv.job_id }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Back to job card
          </Link>
        </div>
      )}

      <PrintPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={`Invoice ${inv.invoice_number} — preview`}
        getPages={() => [{ html: sheetRef.current?.outerHTML ?? "" }]}
        sections={[
          { id: "meta", label: "Dates & status strip" },
          { id: "checks", label: "Service checks" },
          { id: "notes", label: "Notes" },
          { id: "payment", label: "Payment details" },
          { id: "footer", label: "Footer line" },
        ]}
      />

      {/* Inventory library picker — used by both job-linked parts and standalone snapshot lines */}
      <Dialog open={!!libraryTarget} onOpenChange={(o) => !o && setLibraryTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Pick from inventory library</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              placeholder="Search by name, SKU, brand…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="overflow-y-auto flex-1 -mx-1 px-1">
            {(() => {
              const q = librarySearch.toLowerCase().trim();
              const items = (library.data ?? []).filter(
                (it: any) =>
                  !q ||
                  (it.name ?? "").toLowerCase().includes(q) ||
                  (it.sku ?? "").toLowerCase().includes(q) ||
                  (it.brand ?? "").toLowerCase().includes(q),
              );
              if (items.length === 0) {
                return (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No items found.
                  </div>
                );
              }
              return (
                <ul className="divide-y divide-border">
                  {items.map((it: any) => (
                    <li key={it.id}>
                      <button
                        onClick={async () => {
                          const price = Number(it.unit_price ?? 0);
                          const name = [it.sku, it.name].filter(Boolean).join(" — ");
                          if (libraryTarget?.kind === "snapshot") {
                            await updateSnapshotLine(libraryTarget.idx, {
                              description: name,
                              unit: price,
                            });
                          } else if (libraryTarget?.kind === "part") {
                            await updatePart(libraryTarget.id, {
                              name,
                              retail: price,
                              supplier: it.brand ?? "",
                            });
                          }
                          setLibraryTarget(null);
                        }}
                        className="w-full text-left p-3 hover:bg-muted/40 rounded-md flex items-center gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{it.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {[it.sku, it.brand].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <div className="text-sm font-semibold tabular-nums">
                          ${Number(it.unit_price ?? 0).toFixed(2)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceChecks({
  jobId,
  title,
  items,
  onChanged,
  details,
  onSaveDetails,
}: {
  jobId: string | null;
  title: string | null;
  items: any[];
  onChanged: () => void;
  details: string;
  onSaveDetails: (value: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [detailDraft, setDetailDraft] = useState(details);
  useEffect(() => {
    setDetailDraft(details);
  }, [details]);

  async function addItem() {
    if (!jobId || !draft.trim()) return;
    const nextSort = items.length
      ? Math.max(...items.map((i) => Number(i.sort_order ?? 0))) + 1
      : 0;
    const { error } = await supabase
      .from("job_tasks")
      .insert({ job_id: jobId, label: draft.trim(), is_done: true, sort_order: nextSort });
    if (error) return toast.error(error.message);
    setDraft("");
    onChanged();
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from("job_tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChanged();
  }

  async function renameItem(id: string, label: string): Promise<void> {
    const trimmed = label.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("job_tasks").update({ label: trimmed }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onChanged();
  }

  if (!jobId) return null;
  if (items.length === 0 && !title) return null;

  return (
    <div className="pt-5 border-t border-border">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            Work Performed
          </div>
          {title && <div className="font-display text-lg font-bold mt-0.5">{title}</div>}
        </div>
      </div>
      {items.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
          {items.map((t: any) => (
            <li key={t.id} className="group flex items-start gap-2">
              <Check
                className={`h-3.5 w-3.5 mt-0.5 flex-none ${
                  t.is_done ? "text-emerald-500" : "text-muted-foreground/30"
                }`}
                strokeWidth={3}
              />
              <div className="min-w-0 flex-1">
                <EditableText
                  value={t.label}
                  onCommit={(v) => renameItem(t.id, v)}
                  className={
                    t.is_done
                      ? ""
                      : "text-muted-foreground line-through decoration-muted-foreground/40"
                  }
                />
                {t.note && <div className="text-xs text-muted-foreground">{t.note}</div>}
              </div>
              <button
                onClick={() => removeItem(t.id)}
                className="no-print opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5"
                title="Remove item"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="no-print mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder="Add an item performed…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={addItem}
          disabled={!draft.trim()}
          className="grid place-items-center rounded-md border border-border px-3 text-sm hover:bg-primary/10 disabled:opacity-40"
          title="Add item"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3">
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground mb-1">
            Details of work performed
          </div>
          {detailDraft.trim() !== "" && (
            <div className="hidden print:block text-xs leading-relaxed whitespace-pre-wrap">
              {detailDraft}
            </div>
          )}
          <textarea
            value={detailDraft}
            onChange={(e) => setDetailDraft(e.target.value)}
            onBlur={() => {
              if (detailDraft !== details) onSaveDetails(detailDraft);
            }}
            rows={4}
            placeholder="Describe the work carried out — diagnostics, findings, adjustments, tests…"
            className="no-print w-full rounded-lg border border-border bg-background/50 p-3 text-sm leading-relaxed outline-none focus:border-primary resize-y"
          />
      </div>
    </div>
  );
}
function NotesBox({
  invoiceId,
  initial,
  jobNotes,
  onSaved,
}: {
  invoiceId: string;
  initial: string;
  jobNotes: { id: string; body: string; created_at: string }[];
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  // If the invoice has no notes yet, seed the editor with notes from the job card.
  useEffect(() => {
    if (initial.trim() === "" && jobNotes.length > 0 && value === "") {
      setValue(jobNotes.map((n) => n.body).join("\n\n"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobNotes.length]);

  async function save() {
    if (value === initial) return;
    setSaving(true);
    const { error } = await supabase.from("invoices").update({ notes: value }).eq("id", invoiceId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSavedAt(Date.now());
    onSaved();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">Notes</div>
        <div className="text-[0.625rem] text-muted-foreground no-print">
          {saving ? "Saving…" : savedAt ? "Saved" : "Auto-saves on blur"}
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        placeholder="Add notes for the customer — recommendations, follow-ups, parts to order next service…"
        rows={4}
        className="w-full rounded-lg border border-border bg-background/50 p-3 text-sm leading-relaxed outline-none focus:border-primary resize-y print:border-border print:bg-transparent print:resize-none"
      />
    </div>
  );
}
