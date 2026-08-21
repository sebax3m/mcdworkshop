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
  GripVertical,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fullBike } from "@/lib/format";
import logoAsset from "@/assets/motorcycle-doctors-logo.png.asset.json";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTechnicians } from "@/hooks/use-active-technician";
import { PrintPreview } from "@/components/PrintPreview";
import { readCustomerNotes } from "@/components/job/CustomerNotesSection";
import { readWorkPerformed } from "@/components/job/WorkPerformedSection";
import { learnInventoryPrice } from "@/lib/inventory-price-sync";
import { PaymentsCard } from "@/components/invoice/PaymentsCard";

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
  step = "0.01",
  trim = false,
  className = "",
}: {
  value: number;
  onCommit: (n: number) => void | Promise<void>;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  step?: string;
  trim?: boolean;
  className?: string;
}) {
  const fmt = (n: number) => {
    const s = n.toFixed(decimals);
    return trim && s.includes(".") ? s.replace(/\.?0+$/, "") : s;
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fmt(value));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) setDraft(fmt(value));
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
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(fmt(value));
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
      className={`group/edit relative inline-flex items-center justify-end rounded-md pl-5 pr-0 py-0.5 hover:bg-primary/10 hover:text-foreground transition-colors tabular-nums ${className}`}
      title="Click to edit"
    >
      <Pencil className="absolute left-0.5 h-3 w-3 opacity-0 group-hover/edit:opacity-60 no-print" />
      <span>
        {prefix}
        {fmt(value)}
        {suffix}
      </span>
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
      className={`group/edit inline-flex items-start gap-1 text-left rounded-md px-1 -mx-1 hover:bg-primary/10 transition-colors ${
        multiline ? "w-full" : ""
      } ${className}`}
      title={multiline ? "Click to edit (Enter for new line, Esc to cancel)" : "Click to edit"}
    >
      <span className={multiline ? "whitespace-pre-wrap flex-1" : ""}>
        {value || <span className="opacity-50">{placeholder ?? "Add details…"}</span>}
      </span>
      <Pencil className="h-3 w-3 mt-1 opacity-0 group-hover/edit:opacity-60 no-print flex-none" />
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
  const { technicians } = useTechnicians();

  const invoice = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(*), motorcycles(*), jobs(job_number, title, description, odometer, technician_id, assigned_tech_id, service_data)")
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
          .order("sort_order")
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

  // Learned labour/flat rates per service label (e.g. "Dyno" → 950)
  const learnedRates = useQuery({
    queryKey: ["labour-rate-defaults"],
    queryFn: async () =>
      (await supabase.from("labour_rate_defaults").select("service_type, rate")).data ?? [],
  });



  // Ensure every invoice carries a default $30 shop consumables line. Auto-insert
  // once per job if missing, then it behaves like any other editable part line.
  useEffect(() => {
    const jobId = invoice.data?.job_id;
    if (!jobId || !parts.data) return;
    if ((invoice.data?.snapshot as any)?.consumables_removed) return;
    const hasConsumables = parts.data.some((p: any) =>
      (p.name ?? "").toLowerCase().includes("consumable"),
    );
    if (hasConsumables) return;
    (async () => {
      const { error } = await supabase.from("parts").insert({
        job_id: jobId,
        name: "Shop consumables",
        supplier: "Washers, lubricants, cleaners, degreaser, rags & workshop supplies",
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
  }, [invoice.data?.job_id, (invoice.data?.snapshot as any)?.consumables_removed, parts.data, invoiceId, qc]);

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
          dueAt.setDate(dueAt.getDate() + 5);

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

  // ---- Drag & drop reordering of line items -------------------------------
  // NOTE: these must stay ABOVE the early returns below — declaring hooks after a
  // conditional return crashes React with "Rendered more hooks than during the previous render".
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [dragArmed, setDragArmed] = useState<string | null>(null);

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

  // ---- Labour / flat-rate line ------------------------------------------
  const labourTitle = ((inv.snapshot as any)?.labour_title ?? "Labour") as string;
  const rateKey = labourTitle.trim().toLowerCase() || "labour";
  const learnedRate = (learnedRates.data ?? []).find(
    (r: any) => String(r.service_type).toLowerCase() === rateKey,
  )?.rate;
  const snapRate = (inv.snapshot as any)?.labour_rate;
  const labourRate =
    Number(snapRate) > 0
      ? Number(snapRate)
      : Number(learnedRate) > 0
        ? Number(learnedRate)
        : LABOUR_RATE;

  async function learnRate(rate: number) {
    if (!(rate > 0)) return;
    await supabase
      .from("labour_rate_defaults")
      .upsert(
        { service_type: rateKey, rate, updated_at: new Date().toISOString(), updated_by: user?.id ?? null },
        { onConflict: "service_type" },
      );
    qc.invalidateQueries({ queryKey: ["labour-rate-defaults"] });
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
    const currentUnit = labourRate;
    const currentQty = currentUnit > 0 ? currentLabour / currentUnit : 0;
    let nextAmount = currentLabour;
    let nextRate: number | undefined;
    if (amount !== undefined) {
      nextAmount = amount;
      // Keep qty as-is and derive the rate so a flat charge (qty 1 · $950) sticks
      if (currentQty > 0) nextRate = amount / currentQty;
    } else if (qty !== undefined) {
      nextAmount = qty * (unit ?? currentUnit);
      if (unit !== undefined) nextRate = unit;
    } else if (unit !== undefined) {
      nextAmount = (currentQty || 1) * unit;
      nextRate = unit;
    }
    nextAmount = Math.round(nextAmount * 100) / 100;
    if (nextRate !== undefined && nextRate > 0) {
      const rounded = Math.round(nextRate * 100) / 100;
      await saveSnapshotMeta({ labour_rate: rounded });
      await learnRate(rounded);
    }
    await recomputeInvoiceTotals(nextAmount);
  }


  const snapTechId = (inv?.snapshot as any)?.technician_id as string | null | undefined;
  const technicianId =
    snapTechId !== undefined && snapTechId !== null
      ? snapTechId
      : ((inv?.jobs as any)?.technician_id ?? (inv?.jobs as any)?.assigned_tech_id ?? null);
  const technicianName = technicians.find((t) => t.id === technicianId)?.full_name ?? "";

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

  // ---- Drag & drop reordering of line items -------------------------------

  function rowDragProps(key: string, onReorder: (from: string, to: string) => void) {
    return {
      draggable: dragArmed === key,
      onDragStart: (e: React.DragEvent) => {
        setDragKey(key);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", key);
      },
      onDragOver: (e: React.DragEvent) => {
        if (!dragKey) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (overKey !== key) setOverKey(key);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        if (dragKey && dragKey !== key) onReorder(dragKey, key);
        setDragKey(null);
        setOverKey(null);
        setDragArmed(null);
      },
      onDragEnd: () => {
        setDragKey(null);
        setOverKey(null);
        setDragArmed(null);
      },
      className: `border-b border-border/40 align-top group ${dragKey === key ? "opacity-40" : ""} ${
        overKey === key && dragKey !== key ? "bg-primary/5 outline outline-1 outline-primary/50" : ""
      }`,
    };
  }

  function DragHandle({ rowKey }: { rowKey: string }) {
    return (
      <button
        type="button"
        onMouseDown={() => setDragArmed(rowKey)}
        onMouseUp={() => setDragArmed(null)}
        onTouchStart={() => setDragArmed(rowKey)}
        className="no-print shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100"
        title="Drag to reorder"
        aria-label="Drag to reorder line"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    );
  }

  async function persistPartOrder(keys: string[]) {
    const labourIdx = keys.indexOf("labour");
    if (labourIdx >= 0) {
      const newSnap = { ...((inv.snapshot as any) ?? {}), labour_sort: labourIdx };
      await supabase.from("invoices").update({ snapshot: newSnap }).eq("id", invoiceId);
    }
    await Promise.all(
      keys
        .map((k, i) => ({ k, i }))
        .filter(({ k }) => k !== "labour")
        .map(({ k, i }) => supabase.from("parts").update({ sort_order: i } as any).eq("id", k)),
    );
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    qc.invalidateQueries({ queryKey: ["invoice-parts", invoiceId] });
  }

  function reorderKeys(keys: string[], from: string, to: string) {
    const next = [...keys];
    const fromIdx = next.indexOf(from);
    const toIdx = next.indexOf(to);
    if (fromIdx < 0 || toIdx < 0) return next;
    next.splice(toIdx, 0, next.splice(fromIdx, 1)[0]!);
    return next;
  }

  async function moveSnapshotLine(from: string, to: string) {
    const items = currentSnapshotLines();
    const fromIdx = Number(from);
    const toIdx = Number(to);
    if (Number.isNaN(fromIdx) || Number.isNaN(toIdx)) return;
    const next = [...items];
    next.splice(toIdx, 0, next.splice(fromIdx, 1)[0]!);
    await saveSnapshotLines(next);
  }

  async function removeLabourLine() {
    await saveSnapshotMeta({ labour_hidden: true });
    await recomputeInvoiceTotals(0);
  }

  async function restoreLabourLine() {
    await saveSnapshotMeta({ labour_hidden: false });
    await recomputeInvoiceTotals(defaultHours * labourRate);
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
    if (patch.retail != null) {
      const existing = (parts.data ?? []).find((p: any) => p.id === id);
      const partName = patch.name ?? existing?.name ?? null;
      await learnInventoryPrice(partName, patch.retail);
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
    const target = (parts.data ?? []).find((p: any) => p.id === id) as any;
    const isConsumables = (target?.name ?? "").toLowerCase().includes("consumable");
    const { error } = await supabase.from("parts").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (isConsumables) await saveSnapshotMeta({ consumables_removed: true });
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
    if (patch.unit != null) {
      await learnInventoryPrice(items[idx]?.description, patch.unit);
    }
    await saveSnapshotLines(items);
  }
  async function removeSnapshotLine(idx: number) {
    await saveSnapshotLines(currentSnapshotLines().filter((_, i) => i !== idx));
  }
  const customer = inv.customers;
  const bike = inv.motorcycles;
  const issuedAt = new Date(inv.created_at);
  const dueAt = new Date(issuedAt);
  dueAt.setDate(dueAt.getDate() + 5);
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

  const canDelete = isAdmin && ["draft", "unpaid"].includes((inv.status ?? "").toLowerCase());

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
    <div className="space-y-5 mx-auto invoice-page w-full max-w-[220mm]">
      <style>{`
        /* The sheet on screen is a true A4 page (210 x 297mm) including the
           print margins, so what you see is exactly what prints. */
        .invoice-sheet {
          width: 210mm;
          min-height: 297mm;
          padding-block: 6mm;
          margin-inline: auto;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        /* On-screen guide showing where each A4 sheet ends. */
        .invoice-sheet::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent calc(297mm - 1px),
            color-mix(in oklab, var(--primary) 70%, transparent) calc(297mm - 1px),
            color-mix(in oklab, var(--primary) 70%, transparent) 297mm
          );
        }

        /* Inside the print-preview iframe the page box is provided by @page,
           so the sheet must fill it instead of forcing its own A4 size. */
        .sheet .invoice-sheet,
        .sheet-inner .invoice-sheet {
          width: 100% !important;
          min-height: 0 !important;
          padding-block: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          overflow: visible !important;
        }
        .sheet .invoice-sheet::after,
        .sheet-inner .invoice-sheet::after { display: none !important; }

        @media (max-width: 230mm) {
          .invoice-a4-scroll { overflow-x: auto; }
        }


        @media print {
          /* Margins live inside the sheet so screen and print match exactly. */
          @page { size: A4 portrait; margin: 0; }
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
          }
          .invoice-sheet {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            padding-block: 6mm !important;
          }
          .invoice-sheet::after { display: none !important; }
          /* Keep blocks intact but allow the invoice to run onto more pages */
          .invoice-sheet table { page-break-inside: auto; }
          .invoice-sheet tr { page-break-inside: avoid; }
          .invoice-sheet [data-print-section] { page-break-inside: avoid; }
          .invoice-sheet .bg-background { background: #ffffff !important; }
          .invoice-sheet .border-border { border-color: #e5e7eb !important; }
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
                    This permanently removes the invoice. This action cannot be undone.
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

      <PaymentsCard
        invoiceId={invoiceId}
        total={Number(inv.total ?? 0)}
        status={String(inv.status ?? "unpaid")}
        paidAmount={Number(inv.paid_amount ?? 0)}
      />


      <div className="invoice-a4-scroll">
      <div ref={sheetRef} className="card-surface invoice-sheet overflow-hidden">
        {/* Letterhead — the logo is the strongest brand element, so it leads */}
        <div className="bg-background border-b-2 border-border px-6 pt-3 pb-4 text-foreground">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-5">
              <img
                src={logoAsset.url}
                alt="Motorcycle Doctors"
                className="h-28 w-28 object-contain shrink-0"
              />
              <div className="min-w-0">
                <div className="font-display text-3xl font-black tracking-tight leading-none">
                  Motorcycle Doctors
                </div>
                <div className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground mt-1">
                  Motorcycle Doctors LTD · GST Reg N° 99386185
                </div>
                <div className="text-[0.72rem] leading-relaxed text-muted-foreground mt-2">
                  94 Wairau Rd, Wairau Valley, Auckland
                  <br />
                  0800 668 663 · services@mcdr.co.nz
                  <br />
                  www.motorcycle-doctors.co.nz
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[0.7rem] uppercase tracking-[0.3em] text-muted-foreground">
                Tax Invoice
              </div>
              <div className="font-display text-3xl font-black leading-none mt-1">
                {inv.invoice_number}
              </div>
            </div>
          </div>
        </div>




        <div className="px-6 pt-4 pb-3 space-y-4 flex-1 flex flex-col">
          {/* Bill to · Motorcycle · invoice meta */}
          <div
            data-print-section="meta"
            className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-[0.82rem] rounded-lg border border-border px-5 py-4"
          >
            <div className="min-w-0">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground pb-1 mb-1.5 border-b border-border">
                Bill to
              </div>
              <div className="font-bold text-base leading-tight truncate">
                {customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : "—"}
              </div>
              <div className="text-muted-foreground truncate mt-0.5">
                {customer?.phone || "—"}
              </div>
              <div className="text-muted-foreground truncate">{customer?.email || ""}</div>
            </div>
            <div className="min-w-0">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground pb-1 mb-1.5 border-b border-border">
                Motorcycle
              </div>
              <div className="font-bold text-base leading-tight truncate">
                {bike ? fullBike(bike as any) : "—"}
              </div>
              <div className="text-muted-foreground truncate mt-0.5">
                {[
                  bike?.rego ? `Rego ${bike.rego}` : null,
                  (inv.jobs?.odometer ?? bike?.mileage) != null
                    ? `${Number(inv.jobs?.odometer ?? bike?.mileage).toLocaleString()} km`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </div>
            </div>
            <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 pt-3 border-t border-border text-[0.78rem]">
              <span className="flex flex-col">
                <span className="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">Issued</span>
                <b className="text-foreground tabular-nums">{issuedAt.toLocaleDateString()}</b>
              </span>
              <span className="flex flex-col">
                <span className="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">Due</span>
                <b className="text-foreground tabular-nums">{dueAt.toLocaleDateString()}</b>
              </span>
              <span className="flex flex-col">
                <span className="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">Job</span>
                <b className="text-foreground">{inv.jobs ? `#${inv.jobs.job_number}` : "—"}</b>
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">Technician</span>
                <b className="text-foreground print:inline hidden">{technicianName || "—"}</b>

                <select
                  className="no-print rounded-md border border-border bg-background px-1 py-0.5 text-xs font-semibold text-foreground"
                  value={technicianId ?? ""}
                  onChange={(e) => saveSnapshotMeta({ technician_id: e.target.value || null })}
                >
                  <option value="">—</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          </div>


          {/* Work performed — recorded on the job card */}
          {(() => {
            const hidden: string[] = Array.isArray((inv.snapshot as any)?.work_performed_hidden)
              ? (inv.snapshot as any).work_performed_hidden
              : [];
            const all = readWorkPerformed((inv.jobs as any)?.service_data);
            const wp = all.filter((w) => !hidden.includes(w.id));
            if (!all.length) return null;
            return (
              <div className="pt-5 border-t border-border" data-print-section="work-performed">
                <div className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                  Work performed
                </div>
                {wp.length === 0 && (
                  <div className="text-xs text-muted-foreground italic no-print">
                    All entries hidden on this invoice.
                  </div>
                )}
                <div className="space-y-3">
                  {wp.map((w) => (
                    <div key={w.id} className="group flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold">{w.title}</div>
                        {w.detail && (
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5">
                            {w.detail}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          saveSnapshotMeta({ work_performed_hidden: [...hidden, w.id] })
                        }
                        className="no-print opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5"
                        title="Remove from this invoice"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {hidden.length > 0 && (
                  <button
                    onClick={() => saveSnapshotMeta({ work_performed_hidden: [] })}
                    className="no-print mt-3 text-[0.625rem] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    Restore {hidden.length} hidden {hidden.length === 1 ? "entry" : "entries"}
                  </button>
                )}
              </div>
            );
          })()}


          {/* Line items */}
          <div className="pt-5 border-t border-border">
            <table className="w-full text-sm align-top">
              <thead>
                <tr className="text-left text-[0.7rem] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2.5 pr-3 font-semibold w-[30%]">Item</th>
                  <th className="py-2.5 pr-3 font-semibold">Description</th>
                  <th className="py-2.5 pl-3 pr-6 text-right font-semibold w-16">Qty</th>
                  <th className="py-2.5 pl-3 pr-6 text-right font-semibold w-24">Price</th>
                  {hasDiscount && (
                    <th className="py-2.5 pl-3 pr-6 text-right font-semibold w-20">Disc %</th>
                  )}
                  <th className="py-2.5 pl-3 pr-6 text-right font-semibold w-28">Total</th>

                </tr>
              </thead>

              <tbody>
                {inv.job_id &&
                  (() => {
                    const labourVisible = !(inv.snapshot as any)?.labour_hidden;
                    const partList: any[] = parts.data ?? [];
                    const refs: { key: string; sort: number }[] = [];
                    if (labourVisible)
                      refs.push({
                        key: "labour",
                        sort: Number((inv.snapshot as any)?.labour_sort ?? -1),
                      });
                    partList.forEach((p, i) =>
                      refs.push({ key: p.id, sort: Number(p.sort_order ?? i) }),
                    );
                    refs.sort((a, b) => a.sort - b.sort);
                    const keys = refs.map((r) => r.key);
                    const onReorder = (from: string, to: string) =>
                      persistPartOrder(reorderKeys(keys, from, to));

                    const renderLabour = () => {
                      const rate = labourRate;
                      const hourly = Math.abs(rate - LABOUR_RATE) < 0.01;
                      const hours = rate > 0 ? Number(inv.labour_total) / rate : 0;
                      const delta = hours - defaultHours;
                      const snap = (inv.snapshot as any) ?? {};
                      const title = snap.labour_title ?? "Labour";
                      // Work performed is already listed in its own section above —
                      // never repeat it in the labour line description.
                      const wpText = readWorkPerformed((inv.jobs as any)?.service_data)
                        .map((w) => (w.detail ? `${w.title}\n${w.detail}` : w.title))
                        .join("\n\n");
                      const savedDesc =
                        snap.labour_desc && snap.labour_desc.trim() === wpText.trim()
                          ? undefined
                          : snap.labour_desc;
                      const desc =
                        savedDesc ??
                        (hourly
                          ? `Workshop labour · $${rate}/hr (incl. GST)`
                          : `${title} · $${rate.toFixed(2)} each (incl. GST)`);

                      const deltaLabel =
                        !hourly || Math.abs(delta) < 0.01
                          ? null
                          : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}h vs tracked`;

                      return (
                        <tr key="labour" {...rowDragProps("labour", onReorder)}>

                          <td className="py-2.5 pr-3 align-top">
                            <div className="flex items-start gap-2">
                              <DragHandle rowKey="labour" />
                              <EditableText
                                value={title}
                                onCommit={(v) =>
                                  saveSnapshotMeta({ labour_title: v || "Workshop labour" })
                                }
                                className="font-medium leading-snug"
                              />
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 align-top text-xs text-muted-foreground">
                            <EditableText
                              value={desc}
                              multiline
                              placeholder="Describe the work performed…"
                              onCommit={(v) => saveSnapshotMeta({ labour_desc: v })}
                              className="text-xs text-muted-foreground leading-snug whitespace-pre-wrap"
                            />
                            {hourly && defaultHours > 0 && (
                              <span className="no-print"> · tracked {defaultHours.toFixed(2)}h</span>
                            )}
                          </td>
                          <td className="py-2.5 pl-3 pr-6 text-right align-top tabular-nums">
                            <EditableNumber
                              value={hours}
                              onCommit={(n) => updateLabour({ qty: n })}
                              suffix={hourly ? "h" : ""}
                            />

                            {deltaLabel && (
                              <div
                                className={`text-[0.625rem] mt-0.5 no-print ${delta > 0 ? "text-amber-500" : "text-emerald-500"}`}
                              >
                                {deltaLabel}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 pl-3 pr-6 text-right align-top tabular-nums">
                            <EditableNumber
                              value={rate}
                              onCommit={(n) => updateLabour({ unit: n })}
                              prefix="$"
                            />
                          </td>
                          {hasDiscount && (
                            <td className="py-2.5 pl-3 pr-6 text-right align-top text-muted-foreground">
                              —
                            </td>
                          )}
                          <td className="py-2.5 pl-3 pr-6 text-right font-semibold align-top tabular-nums relative">
                            <div className="flex items-start justify-end">
                              <EditableNumber
                                value={Number(inv.labour_total)}
                                onCommit={(n) => updateLabour({ amount: n })}
                                prefix="$"
                              />
                              <button
                                onClick={removeLabourLine}
                                className="no-print absolute right-0 top-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                title="Remove labour line"
                              >
                                <Trash2 className="h-3.5 w-3.5 inline" />
                              </button>
                            </div>
                          </td>
                        </tr>

                      );
                    };

                    const renderPart = (p: any) => {
                      const unit = Number(p.retail ?? 0);
                      const qty = Number(p.quantity ?? 1);
                      const disc = Number(p.discount_pct ?? 0);
                      const gross = unit * qty;
                      const net = gross * (1 - disc / 100);
                      return (
                        <tr key={p.id} {...rowDragProps(p.id, onReorder)}>
                          <td className="py-2.5 pr-3 align-top">
                            <div className="flex items-start gap-2">
                              <DragHandle rowKey={p.id} />
                              <EditableText
                                value={p.name ?? ""}
                                onCommit={(v) => updatePart(p.id, { name: v })}
                                className="font-medium leading-snug flex-1"
                              />
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
                          <td className="py-2.5 pr-3 align-top">
                            <EditableText
                              value={p.supplier ?? ""}
                              onCommit={(v) => updatePart(p.id, { supplier: v })}
                              multiline={(p.name ?? "").toLowerCase().includes("consumable")}
                              placeholder={
                                (p.name ?? "").toLowerCase().includes("consumable")
                                  ? "Washers, lubricants, cleaners, degreaser, rags…"
                                  : "—"
                              }
                              className="text-xs text-muted-foreground block leading-snug whitespace-pre-wrap"
                            />
                          </td>
                          <td className="py-2.5 pl-3 pr-6 text-right align-top tabular-nums">
                            <EditableNumber
                              value={qty}
                              decimals={2}
                              trim
                              step="0.5"
                              onCommit={(n) => updatePart(p.id, { quantity: n })}
                            />
                          </td>
                          <td className="py-2.5 pl-3 pr-6 text-right align-top tabular-nums">
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
                            <td className="py-2.5 pl-3 pr-6 text-right align-top tabular-nums">
                              <div className="inline-flex items-center gap-1">
                                <EditableNumber
                                  value={disc}
                                  suffix="%"
                                  onCommit={(n) =>
                                    updatePart(p.id, {
                                      discount_pct: Math.max(0, Math.min(100, n)),
                                    })
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
                          <td className="py-2.5 pl-3 pr-6 text-right font-semibold align-top tabular-nums relative">

                            <div className="flex items-start justify-end">
                              <div className="text-right">
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
                              </div>
                              <button
                                onClick={() => deletePart(p.id)}
                                className="no-print absolute right-0 top-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                title="Remove line"
                              >
                                <Trash2 className="h-3.5 w-3.5 inline" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    };

                    return refs.map((r) =>
                      r.key === "labour"
                        ? renderLabour()
                        : renderPart(partList.find((p) => p.id === r.key)),
                    );
                  })()}
                {inv.job_id && (
                  <tr className="no-print">
                    <td colSpan={hasDiscount ? 6 : 5} className="pt-2">
                      <button
                        onClick={addJobPart}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Add line item
                      </button>
                      {(inv.snapshot as any)?.consumables_removed && (
                        <button
                          onClick={() => saveSnapshotMeta({ consumables_removed: false })}
                          className="ml-4 text-xs text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add shop consumables
                        </button>
                      )}
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
                      item_name?: string;
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
                            colSpan={hasDiscount ? 6 : 5}
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
                      const itemName = it.item_name?.trim() ? it.item_name : it.description;
                      const detail = it.item_name?.trim() ? it.description : "";
                      return (
                        <tr key={idx} {...rowDragProps(String(idx), moveSnapshotLine)}>
                          <td className="py-2.5 pr-3 align-top">
                            <div className="flex items-start gap-2">
                              <DragHandle rowKey={String(idx)} />
                              <EditableText
                                value={itemName}
                                onCommit={(v) =>
                                  updateSnapshotLine(
                                    idx,
                                    it.item_name?.trim()
                                      ? ({ item_name: v } as any)
                                      : { description: v },
                                  )
                                }
                                className="font-medium leading-snug flex-1"
                              />
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
                          <td className="py-2.5 pr-3 align-top">
                            <EditableText
                              value={detail}
                              multiline
                              placeholder="—"
                              onCommit={(v) =>
                                updateSnapshotLine(
                                  idx,
                                  it.item_name?.trim()
                                    ? { description: v }
                                    : ({ item_name: itemName, description: v } as any),
                                )
                              }
                              className="text-xs text-muted-foreground block leading-snug whitespace-pre-wrap"
                            />
                          </td>
                          <td className="py-2.5 pl-3 pr-6 text-right align-top tabular-nums">
                            <EditableNumber
                              value={Number(it.quantity)}
                              decimals={2}
                              trim
                              step="0.5"
                              onCommit={(n) => updateSnapshotLine(idx, { quantity: n })}
                            />
                          </td>
                          <td className="py-2.5 pl-3 pr-6 text-right align-top tabular-nums">
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
                            <td className="py-2.5 pl-3 pr-6 text-right align-top tabular-nums">
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
                          <td className="py-2.5 pl-3 pr-6 text-right font-semibold align-top tabular-nums relative">
                            <div className="flex items-start justify-end">
                              <div className="text-right">
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
                              </div>
                              <button
                                onClick={() => removeSnapshotLine(idx)}
                                className="no-print absolute right-0 top-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                title="Remove line"
                              >
                                <Trash2 className="h-3.5 w-3.5 inline" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}

                {!inv.job_id && (
                  <tr className="no-print">
                    <td colSpan={hasDiscount ? 6 : 5} className="pt-2">
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
                        colSpan={hasDiscount ? 6 : 5}
                        className="py-6 text-center text-xs text-muted-foreground"
                      >
                        No line items
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>

          {/* Notes — pushed to the bottom so it sits right above the payment rule */}
          <div
            data-print-section="notes"
            style={{ marginTop: "auto" }}
            className="pt-3 border-t border-border"
          >
            <NotesBox
              invoiceId={invoiceId}
              initial={inv.notes ?? ""}
              suggestion={readCustomerNotes((inv.jobs as any)?.service_data)}
              onSaved={() => qc.invalidateQueries({ queryKey: ["invoice", invoiceId] })}
            />
          </div>

          {/* Payment details + totals — anchored to the bottom of the A4 sheet,
              with the final total sitting in the bottom-right corner. */}
          <div className="pt-3 mt-3 border-t border-border grid grid-cols-1 sm:grid-cols-[1fr_17rem] gap-6 items-end">

            <div data-print-section="payment" className="text-xs">
              <div className="font-display text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Payment Details
              </div>
              <div className="space-y-0.5">
                <div>
                  <span className="text-muted-foreground">Account:</span> Motorcycle Doctors LTD
                </div>
                <div>
                  <span className="text-muted-foreground">Bank:</span> ASB Bank
                </div>
                <div>
                  <span className="text-muted-foreground">Account #:</span> 12-3072-0008398-00
                </div>
                <div>
                  <span className="text-muted-foreground">Reference:</span> {inv.invoice_number}
                </div>
              </div>
            </div>

            <div className="text-xs">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">Labour (incl GST)</span>
                <span className="tabular-nums">${Number(inv.labour_total).toFixed(2)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">Parts (incl GST)</span>
                <span className="tabular-nums">${Number(inv.parts_total).toFixed(2)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">Subtotal (excl GST)</span>
                <span className="tabular-nums">${subtotalEx.toFixed(2)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4 pb-1 border-b border-border">
                <span className="text-muted-foreground">GST 15% (incl.)</span>
                <span className="tabular-nums">${Number(inv.gst).toFixed(2)}</span>
              </div>
              <div className="flex items-baseline justify-between gap-4 pt-1.5 mt-1 border-t-2 border-foreground/80 font-display text-lg font-black leading-none">
                <span>TOTAL</span>
                <span className="red-gradient-text tabular-nums">
                  ${Number(inv.total).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

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

      <InvoicePrintPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={`Invoice ${inv.invoice_number} — preview`}
        getHtml={() => sheetRef.current?.outerHTML ?? ""}
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

          <NewInventoryItemForm
            defaultName={librarySearch}
            onCreated={async (it) => {
              await library.refetch();
              const price = Number(it.unit_price ?? 0);
              const name = [it.sku, it.name].filter(Boolean).join(" — ");
              if (libraryTarget?.kind === "snapshot") {
                await updateSnapshotLine(libraryTarget.idx, { description: name, unit: price });
              } else if (libraryTarget?.kind === "part") {
                await updatePart(libraryTarget.id, {
                  name,
                  retail: price,
                  supplier: it.brand ?? "",
                });
              }
              setLibraryTarget(null);
            }}
          />

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

/** Quickly add a brand-new inventory item without leaving the invoice. */
function NewInventoryItemForm({
  defaultName,
  onCreated,
}: {
  defaultName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (item: any) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = (name || defaultName).trim();
    if (!n) return toast.error("Name is required");
    setSaving(true);
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({
        name: n,
        sku: sku.trim() || null,
        brand: brand.trim() || null,
        unit_price: Number(price) || 0,
        category: "General",
      })
      .select("*")
      .maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${n} added to inventory`);
    setName("");
    setSku("");
    setBrand("");
    setPrice("");
    setOpen(false);
    if (data) await onCreated(data);
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setName(defaultName);
          setOpen(true);
        }}
        className="mt-2 self-start inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary"
      >
        + New inventory item
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-border p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Motul 7100 10W-40 1L)"
          className="col-span-2 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
        />
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="SKU (optional)"
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
        />
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="Brand / supplier (optional)"
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          placeholder="Price incl. GST"
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save & use"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function NotesBox({
  invoiceId,
  initial,
  suggestion,
  onSaved,
}: {
  invoiceId: string;
  initial: string;
  suggestion?: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  // Notes are invoice-only; do not auto-seed job/book-in notes so internal
  // instructions never leak onto the customer invoice.
  // (kept empty intentionally)

  async function save(next?: string) {
    const text = next ?? value;
    if (text === initial) return;
    setSaving(true);
    const { error } = await supabase.from("invoices").update({ notes: text }).eq("id", invoiceId);
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
        <div className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes</div>
        <div className="text-[0.625rem] text-muted-foreground no-print">
          {saving ? "Saving…" : savedAt ? "Saved" : ""}
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => save()}
        placeholder="Add notes for the customer — recommendations, follow-ups, parts to order next service…"
        rows={4}
        className="w-full rounded-lg border border-border bg-background/50 p-3 text-sm leading-relaxed outline-none focus:border-primary resize-y print:border-border print:bg-transparent print:resize-none"
      />
      {suggestion?.trim() && suggestion.trim() !== value.trim() && (
        <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 no-print print:hidden">
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground mb-1">
            Technician notes from the job card
          </div>
          <p className="text-xs whitespace-pre-wrap text-muted-foreground">{suggestion}</p>
          <button
            onClick={() => {
              const merged = value.trim() ? `${value.trim()}\n${suggestion.trim()}` : suggestion.trim();
              setValue(merged);
              save(merged);
            }}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Use these notes
          </button>
        </div>
      )}
    </div>
  );
}
