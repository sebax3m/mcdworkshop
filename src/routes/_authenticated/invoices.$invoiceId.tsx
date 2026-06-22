import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Printer, Mail, FileDown, Pencil, Check, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fullBike } from "@/lib/format";
import logo from "@/assets/apex-logo.png";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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
  useEffect(() => { if (!editing) setDraft(value.toFixed(decimals)); }, [value, editing, decimals]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

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
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setDraft(value.toFixed(decimals)); setEditing(false); }
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
      <span>{prefix}{value.toFixed(decimals)}{suffix}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 no-print" />
    </button>
  );
}

export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { invoiceId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

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
    queryFn: async () => (await supabase.from("parts").select("*").eq("job_id", invoice.data!.job_id!).order("created_at")).data ?? [],
  });

  const timeEntries = useQuery({
    queryKey: ["invoice-time", invoiceId, invoice.data?.job_id],
    enabled: !!invoice.data?.job_id,
    queryFn: async () =>
      (await supabase.from("time_entries").select("minutes").eq("job_id", invoice.data!.job_id!)).data ?? [],
  });

  const checks = useQuery({
    queryKey: ["invoice-checks", invoiceId, invoice.data?.job_id],
    enabled: !!invoice.data?.job_id,
    queryFn: async () =>
      (await supabase
        .from("job_tasks")
        .select("id,label,is_done,note,sort_order")
        .eq("job_id", invoice.data!.job_id!)
        .order("sort_order")).data ?? [],
  });

  // Ensure every invoice carries a default $30 shop consumables line. Auto-insert
  // once per job if missing, then it behaves like any other editable part line.
  useEffect(() => {
    const jobId = invoice.data?.job_id;
    if (!jobId || !parts.data) return;
    const hasConsumables = parts.data.some(
      (p: any) => (p.name ?? "").toLowerCase().includes("consumable"),
    );
    if (hasConsumables) return;
    (async () => {
      const { error } = await supabase
        .from("parts")
        .insert({ job_id: jobId, name: "Shop consumables", quantity: 1, retail: 30, on_invoice: true });
      if (error) return;
      const fresh = await supabase.from("parts").select("*").eq("job_id", jobId);
      const partsSum = (fresh.data ?? []).reduce(
        (s: number, p: any) => s + Number(p.retail ?? 0) * Number(p.quantity ?? 1),
        0,
      );
      const subtotal = Number(invoice.data!.labour_total) + partsSum;
      const gst = Math.round((subtotal * GST_RATE / (1 + GST_RATE)) * 100) / 100;
      const total = Math.round(subtotal * 100) / 100;
      await supabase.from("invoices").update({ parts_total: partsSum, gst, total }).eq("id", invoiceId);
      qc.invalidateQueries({ queryKey: ["invoice-parts", invoiceId, jobId] });
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    })();
  }, [invoice.data?.job_id, parts.data, invoiceId, qc]);

  if (invoice.isLoading) return <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!invoice.data) return <div className="card-surface p-8 text-center text-sm text-muted-foreground">Invoice not found.</div>;

  const inv = invoice.data;
  const defaultHours =
    (timeEntries.data ?? []).reduce((s: number, t: any) => s + Number(t.minutes ?? 0), 0) / 60;

  async function recomputeInvoiceTotals(nextLabour?: number) {
    const labour = Number(nextLabour ?? inv.labour_total);
    const partsSum = (parts.data ?? []).reduce(
      (s: number, p: any) => s + Number(p.retail ?? 0) * Number(p.quantity ?? 1),
      0,
    );
    const subtotal = labour + partsSum; // inc GST
    const gst = Math.round((subtotal * GST_RATE / (1 + GST_RATE)) * 100) / 100;
    const total = Math.round(subtotal * 100) / 100;
    const { error } = await supabase
      .from("invoices")
      .update({ labour_total: labour, parts_total: partsSum, gst, total })
      .eq("id", invoiceId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
  }

  async function updateLabour({ qty, unit, amount }: { qty?: number; unit?: number; amount?: number }) {
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

  async function updatePart(id: string, patch: { quantity?: number; retail?: number }) {
    const { error } = await supabase.from("parts").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["invoice-parts", invoiceId, inv.job_id] });
    // Re-fetch then recompute via fresh parts list
    const fresh = await supabase.from("parts").select("*").eq("job_id", inv.job_id!);
    const partsSum = (fresh.data ?? []).reduce(
      (s: number, p: any) => s + Number(p.retail ?? 0) * Number(p.quantity ?? 1),
      0,
    );
    const subtotal = Number(inv.labour_total) + partsSum;
    const gst = Math.round((subtotal * GST_RATE / (1 + GST_RATE)) * 100) / 100;
    const total = Math.round(subtotal * 100) / 100;
    await supabase.from("invoices").update({ parts_total: partsSum, gst, total }).eq("id", invoiceId);
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
  }
  const customer = inv.customers;
  const bike = inv.motorcycles;
  const issuedAt = new Date(inv.created_at);
  const dueAt = new Date(issuedAt); dueAt.setDate(dueAt.getDate() + 14);
  const subtotalInc = Number(inv.labour_total) + Number(inv.parts_total);
  const subtotalEx = subtotalInc / (1 + GST_RATE);

  function emailInvoice() {
    const to = customer?.email ?? "";
    const name = customer ? `${customer.first_name ?? ""}`.trim() : "there";
    const subject = `Invoice ${inv.invoice_number} from APEX MOTO LAB`;
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
      `APEX MOTO LAB`,
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto invoice-page">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: #ffffff !important; color: #000 !important; }
          body * { visibility: hidden !important; }
          .invoice-page, .invoice-page * { visibility: visible !important; }
          .invoice-page { position: absolute; left: 0; top: 0; width: 100%; max-width: none; margin: 0; padding: 0; }
          .invoice-sheet { box-shadow: none !important; border: none !important; background: #ffffff !important; color: #000 !important; }
          .invoice-sheet .text-muted-foreground { color: #4b5563 !important; }
          .invoice-sheet .gold-gradient-text,
          .invoice-sheet [class*="gold"] { color: #b8860b !important; background: none !important; -webkit-text-fill-color: #b8860b !important; }
          .invoice-sheet .border-border,
          .invoice-sheet [class*="border-"] { border-color: #d1d5db !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <header className="flex items-center gap-3 print:hidden">
        <button onClick={() => nav({ to: "/invoices" })} className="grid h-9 w-9 place-items-center rounded-lg border border-border">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Invoice</div>
          <h1 className="font-display text-xl sm:text-2xl font-bold truncate">{inv.invoice_number}</h1>
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
          <Button onClick={() => window.print()} variant="outline" className="gap-2">
            <FileDown className="h-4 w-4" /> Save PDF
          </Button>
          <Button onClick={() => window.print()} className="gold-surface gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </header>

      <div className="card-surface invoice-sheet overflow-hidden">
        {/* Gold banner */}
        <div className="gold-surface px-8 py-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <img src={logo} alt="APEX MOTO LAB" className="h-14 w-14 rounded-md object-contain bg-black/10 p-1" />
            <div>
              <div className="font-display text-3xl font-black tracking-tight">APEX MOTO LAB</div>
              <div className="text-xs uppercase tracking-[0.3em] opacity-80 mt-1">Premium Motorcycle Workshop</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.25em] opacity-80">Tax Invoice</div>
            <div className="font-display text-2xl font-black">{inv.invoice_number}</div>
          </div>
        </div>

        <div className="p-8 space-y-7">
          {/* Meta strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Issued</div>
              <div className="font-semibold">{issuedAt.toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Due</div>
              <div className="font-semibold">{dueAt.toLocaleDateString()}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
              <div className="font-semibold uppercase">{inv.status}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Job</div>
              <div className="font-semibold">{inv.jobs ? `#${inv.jobs.job_number}` : "—"}</div>
            </div>
          </div>

          {/* Bill to + Bike */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-5 border-t border-border">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Bill To</div>
              <div className="font-display text-lg font-bold">{customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : "—"}</div>
              {customer?.email && <div className="text-sm text-muted-foreground">{customer.email}</div>}
              {customer?.phone && <div className="text-sm text-muted-foreground">{customer.phone}</div>}
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Motorcycle</div>
              <div className="font-display text-lg font-bold">{bike ? fullBike(bike as any) : "—"}</div>
              {bike?.rego && <div className="text-sm text-muted-foreground">Rego: {bike.rego}</div>}
              {(inv.jobs?.odometer ?? bike?.mileage) != null && (
                <div className="text-sm text-muted-foreground">
                  Odometer: {Number(inv.jobs?.odometer ?? bike?.mileage).toLocaleString()} km
                </div>
              )}
            </div>
          </div>

          {/* Service checks */}
          <ServiceChecks
            jobId={inv.job_id}
            title={inv.jobs?.title ?? null}
            items={checks.data ?? []}
            onChanged={() => qc.invalidateQueries({ queryKey: ["invoice-checks", invoiceId, inv.job_id] })}
          />

          {/* Line items */}
          <div className="pt-5 border-t border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">Line Items</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2.5">Description</th>
                  <th className="py-2.5 text-right w-16">Qty</th>
                  <th className="py-2.5 text-right w-24">Unit</th>
                  <th className="py-2.5 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rate = LABOUR_RATE;
                  const hours = Number(inv.labour_total) / rate;
                  const delta = hours - defaultHours;
                  const deltaLabel =
                    Math.abs(delta) < 0.01
                      ? null
                      : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}h vs tracked`;
                  return (
                    <tr className="border-b border-border/40">
                      <td className="py-3">
                        <div className="font-medium">Workshop labour</div>
                        <div className="text-xs text-muted-foreground">
                          Diagnostics, service & repair · $130/hr (incl. GST)
                          {defaultHours > 0 && (
                            <span className="no-print"> · tracked {defaultHours.toFixed(2)}h</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-right">
                        <EditableNumber value={hours} onCommit={(n) => updateLabour({ qty: n })} suffix="h" />
                        {deltaLabel && (
                          <div className={`text-[10px] mt-0.5 no-print ${delta > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                            {deltaLabel}
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <EditableNumber value={rate} onCommit={(n) => updateLabour({ unit: n })} prefix="$" />
                      </td>
                      <td className="py-3 text-right font-semibold">
                        <EditableNumber value={Number(inv.labour_total)} onCommit={(n) => updateLabour({ amount: n })} prefix="$" />
                      </td>
                    </tr>
                  );
                })()}
                {(parts.data ?? []).map((p: any) => {
                  const unit = Number(p.retail ?? 0);
                  const qty = Number(p.quantity ?? 1);
                  return (
                    <tr key={p.id} className="border-b border-border/40">
                      <td className="py-3">
                        <div className="font-medium">{p.name}</div>
                        {p.supplier && <div className="text-xs text-muted-foreground">{p.supplier}</div>}
                      </td>
                      <td className="py-3 text-right">
                        <EditableNumber value={qty} decimals={0} onCommit={(n) => updatePart(p.id, { quantity: n })} />
                      </td>
                      <td className="py-3 text-right">
                        <EditableNumber value={unit} prefix="$" onCommit={(n) => updatePart(p.id, { retail: n })} />
                      </td>
                      <td className="py-3 text-right font-semibold">
                        <EditableNumber
                          value={unit * qty}
                          prefix="$"
                          onCommit={(n) => updatePart(p.id, { retail: qty > 0 ? n / qty : n })}
                        />
                      </td>
                    </tr>
                  );
                })}
                {Number(inv.labour_total) === 0 && (parts.data ?? []).length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">No line items</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="pt-5 border-t border-border flex justify-end">
            <div className="w-full sm:w-72 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Labour (incl GST)</span><span className="tabular-nums">${Number(inv.labour_total).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Parts (incl GST)</span><span className="tabular-nums">${Number(inv.parts_total).toFixed(2)}</span></div>
              <div className="flex justify-between pb-2 border-b border-border"><span className="text-muted-foreground">Subtotal (excl GST)</span><span className="tabular-nums">${subtotalEx.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST 15% (incl. in above)</span><span className="tabular-nums">${Number(inv.gst).toFixed(2)}</span></div>
              <div className="flex justify-between pt-3 mt-1 border-t-2 border-foreground/80 font-display text-xl font-black">
                <span>TOTAL</span>
                <span className="gold-gradient-text tabular-nums">${Number(inv.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment info */}
          <div className="pt-5 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Payment Details</div>
              <div className="space-y-0.5 text-xs">
                <div><span className="text-muted-foreground">Account:</span> APEX MOTO LAB</div>
                <div><span className="text-muted-foreground">BSB:</span> 000-000</div>
                <div><span className="text-muted-foreground">Account #:</span> 0000 0000</div>
                <div><span className="text-muted-foreground">Reference:</span> {inv.invoice_number}</div>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Notes</div>
              <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                {inv.notes || "Payment due within 14 days. Thank you for choosing APEX MOTO LAB."}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-5 border-t border-border text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            APEX MOTO LAB · Workshop OS · Thank you for your business
          </div>
        </div>
      </div>

      {inv.job_id && (
        <div className="print:hidden text-center">
          <Link to="/jobs/$jobId" params={{ jobId: inv.job_id }} className="text-xs text-muted-foreground hover:text-foreground underline">
            Back to job card
          </Link>
        </div>
      )}
    </div>
  );
}

function ServiceChecks({
  jobId,
  title,
  items,
  onChanged,
}: {
  jobId: string | null;
  title: string | null;
  items: any[];
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState("");

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

  async function renameItem(id: string, label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("job_tasks").update({ label: trimmed }).eq("id", id);
    if (error) return toast.error(error.message);
    onChanged();
  }

  if (!jobId) return null;
  if (items.length === 0 && !title) return null;

  return (
    <div className="pt-5 border-t border-border">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Work Performed
          </div>
          {title && <div className="font-display text-lg font-bold mt-0.5">{title}</div>}
        </div>
      </div>
      {items.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {items.map((t: any) => (
            <li key={t.id} className="group flex items-start gap-2">
              <span
                className={`mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-sm border ${
                  t.is_done
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-500"
                    : "border-border text-muted-foreground/40"
                }`}
              >
                {t.is_done && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
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
            if (e.key === "Enter") { e.preventDefault(); addItem(); }
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
    </div>
  );
}