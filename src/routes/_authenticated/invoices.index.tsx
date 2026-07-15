import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/invoices/")({
  component: InvoicesList,
});

function InvoicesList() {
  const invoices = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, status, total, created_at, customers(first_name, last_name), motorcycles(make, model, rego), jobs(job_number, title)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Billing</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Invoices</h1>
        </div>
      </header>

      {invoices.isLoading && (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
      )}

      {!invoices.isLoading && (invoices.data?.length ?? 0) === 0 && (
        <div className="card-surface p-10 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/60 mb-2" />
          <p className="text-sm text-muted-foreground">
            No invoices yet. Create one from a job card.
          </p>
        </div>
      )}

      <div className="grid gap-2">
        {(invoices.data ?? []).map((inv: any) => {
          const customer = inv.customers
            ? `${inv.customers.first_name ?? ""} ${inv.customers.last_name ?? ""}`.trim()
            : "—";
          const bike = inv.motorcycles
            ? `${inv.motorcycles.make ?? ""} ${inv.motorcycles.model ?? ""}`.trim()
            : "";
          return (
            <Link
              key={inv.id}
              to="/invoices/$invoiceId"
              params={{ invoiceId: inv.id }}
              className="card-surface p-4 flex items-center gap-4 hover:border-primary/50 transition-colors"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-primary shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{inv.invoice_number}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {customer}
                  {bike ? ` · ${bike}` : ""}
                  {inv.jobs ? ` · Job #${inv.jobs.job_number}` : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-lg font-bold gold-gradient-text">
                  ${Number(inv.total).toFixed(2)}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {inv.status}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
