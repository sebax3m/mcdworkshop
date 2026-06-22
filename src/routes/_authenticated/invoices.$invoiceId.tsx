import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fullBike } from "@/lib/format";

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

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <header className="flex items-center gap-3 print:hidden">
        <button onClick={() => nav({ to: "/invoices" })} className="grid h-9 w-9 place-items-center rounded-lg border border-border">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Invoice</div>
          <h1 className="font-display text-xl sm:text-2xl font-bold truncate">{inv.invoice_number}</h1>
        </div>
        <Button onClick={() => window.print()} className="gold-surface gap-2"><Printer className="h-4 w-4" /> Print</Button>
      </header>

      <div className="card-surface p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="font-display text-2xl font-bold gold-gradient-text">APEX MOTO LAB</div>
            <div className="text-xs text-muted-foreground mt-1">Workshop OS</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Invoice</div>
            <div className="font-display text-xl font-bold">{inv.invoice_number}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{new Date(inv.created_at).toLocaleDateString()}</div>
            <div className="mt-2 inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              {inv.status}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Bill To</div>
            <div className="font-semibold">{customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : "—"}</div>
            {customer?.email && <div className="text-xs text-muted-foreground">{customer.email}</div>}
            {customer?.phone && <div className="text-xs text-muted-foreground">{customer.phone}</div>}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Motorcycle</div>
            <div className="font-semibold">{bike ? fullBike(bike as any) : "—"}</div>
            {bike?.rego && <div className="text-xs text-muted-foreground">Rego: {bike.rego}</div>}
            {inv.jobs && (
              <div className="text-xs text-muted-foreground mt-1">
                Job #{inv.jobs.job_number} · {inv.jobs.title}
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Line items</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2">Description</th>
                <th className="py-2 text-right w-16">Qty</th>
                <th className="py-2 text-right w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {Number(inv.labour_total) > 0 && (
                <tr className="border-b border-border/40">
                  <td className="py-2">Workshop labour</td>
                  <td className="py-2 text-right">—</td>
                  <td className="py-2 text-right tabular-nums">${Number(inv.labour_total).toFixed(2)}</td>
                </tr>
              )}
              {(parts.data ?? []).map((p: any) => (
                <tr key={p.id} className="border-b border-border/40">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-right tabular-nums">{p.quantity}</td>
                  <td className="py-2 text-right tabular-nums">${(Number(p.retail ?? 0) * Number(p.quantity ?? 1)).toFixed(2)}</td>
                </tr>
              ))}
              {Number(inv.labour_total) === 0 && (parts.data ?? []).length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-xs text-muted-foreground">No line items</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-4 border-t border-border flex justify-end">
          <div className="w-full sm:w-64 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Labour</span><span className="tabular-nums">${Number(inv.labour_total).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Parts</span><span className="tabular-nums">${Number(inv.parts_total).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="tabular-nums">${Number(inv.gst).toFixed(2)}</span></div>
            <div className="flex justify-between pt-2 border-t border-border font-display text-lg font-bold">
              <span>Total</span>
              <span className="gold-gradient-text tabular-nums">${Number(inv.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {inv.notes && (
          <div className="pt-4 border-t border-border">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
            <p className="text-sm whitespace-pre-wrap">{inv.notes}</p>
          </div>
        )}
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