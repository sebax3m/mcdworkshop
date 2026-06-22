import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Printer, Mail, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fullBike } from "@/lib/format";
import logo from "@/assets/apex-logo.png";

export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { invoiceId } = Route.useParams();
  const nav = useNavigate();

  const invoice = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(*), motorcycles(*), jobs(job_number, title, description)")
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

  if (invoice.isLoading) return <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!invoice.data) return <div className="card-surface p-8 text-center text-sm text-muted-foreground">Invoice not found.</div>;

  const inv = invoice.data;
  const customer = inv.customers;
  const bike = inv.motorcycles;
  const issuedAt = new Date(inv.created_at);
  const dueAt = new Date(issuedAt); dueAt.setDate(dueAt.getDate() + 14);
  const subtotal = Number(inv.labour_total) + Number(inv.parts_total);

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
              {inv.jobs?.title && <div className="text-sm text-muted-foreground">Service: {inv.jobs.title}</div>}
            </div>
          </div>

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
                {Number(inv.labour_total) > 0 && (() => {
                  const rateEx = 130 / 1.1;
                  const hours = Number(inv.labour_total) / rateEx;
                  return (
                    <tr className="border-b border-border/40">
                      <td className="py-3">
                        <div className="font-medium">Workshop labour</div>
                        <div className="text-xs text-muted-foreground">Diagnostics, service & repair · $130/hr (incl. GST)</div>
                      </td>
                      <td className="py-3 text-right tabular-nums">{hours.toFixed(2)}</td>
                      <td className="py-3 text-right tabular-nums">${rateEx.toFixed(2)}</td>
                      <td className="py-3 text-right tabular-nums font-semibold">${Number(inv.labour_total).toFixed(2)}</td>
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
                      <td className="py-3 text-right tabular-nums">{qty}</td>
                      <td className="py-3 text-right tabular-nums">${unit.toFixed(2)}</td>
                      <td className="py-3 text-right tabular-nums font-semibold">${(unit * qty).toFixed(2)}</td>
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
              <div className="flex justify-between"><span className="text-muted-foreground">Labour</span><span className="tabular-nums">${Number(inv.labour_total).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Parts</span><span className="tabular-nums">${Number(inv.parts_total).toFixed(2)}</span></div>
              <div className="flex justify-between pb-2 border-b border-border"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST (10%)</span><span className="tabular-nums">${Number(inv.gst).toFixed(2)}</span></div>
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