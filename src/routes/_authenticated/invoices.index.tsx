/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { invoiceStatusMeta } from "@/components/invoice/PaymentsCard";

export const Route = createFileRoute("/_authenticated/invoices/")({
  component: InvoicesList,
});

type Filter = "all" | "unpaid" | "part_paid" | "paid";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "part_paid", label: "Part paid" },
  { value: "paid", label: "Paid" },
];

function InvoicesList() {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const invoices = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, status, total, paid_amount, created_at, customers(first_name, last_name), motorcycles(make, model, rego), jobs(job_number, title)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (invoices.data ?? []).filter((inv: any) => {
      const paid = Number(inv.paid_amount ?? 0);
      const total = Number(inv.total ?? 0);
      const meta = invoiceStatusMeta(String(inv.status ?? ""), paid, total);
      if (filter === "unpaid" && meta.label !== "Unpaid") return false;
      if (filter === "part_paid" && meta.label !== "Part paid") return false;
      if (filter === "paid" && meta.label !== "Paid") return false;
      if (!term) return true;
      const hay = [
        inv.invoice_number,
        inv.customers?.first_name,
        inv.customers?.last_name,
        inv.motorcycles?.make,
        inv.motorcycles?.model,
        inv.motorcycles?.rego,
        inv.jobs?.job_number,
        inv.jobs?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [invoices.data, filter, q]);

  const totals = useMemo(() => {
    let outstanding = 0;
    let unpaidCount = 0;
    for (const inv of invoices.data ?? []) {
      const due = Number(inv.total ?? 0) - Number(inv.paid_amount ?? 0);
      if (due > 0.005) {
        outstanding += due;
        unpaidCount += 1;
      }
    }
    return { outstanding, unpaidCount };
  }, [invoices.data]);

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Billing</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Invoices</h1>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding</div>
          <div className="font-display text-xl font-bold text-amber-400">
            ${totals.outstanding.toFixed(2)}
          </div>
          <div className="text-[0.65rem] text-muted-foreground">
            {totals.unpaidCount} invoice{totals.unpaidCount === 1 ? "" : "s"} awaiting payment
          </div>
        </div>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search invoice #, customer, bike, rego, job…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {invoices.isLoading && (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
      )}

      {!invoices.isLoading && rows.length === 0 && (
        <div className="card-surface p-10 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/60 mb-2" />
          <p className="text-sm text-muted-foreground">
            {(invoices.data?.length ?? 0) === 0
              ? "No invoices yet. Create one from a job card."
              : "No invoices match this filter."}
          </p>
        </div>
      )}

      <div className="grid gap-2">
        {rows.map((inv: any) => {
          const customer = inv.customers
            ? `${inv.customers.first_name ?? ""} ${inv.customers.last_name ?? ""}`.trim()
            : "—";
          const bike = inv.motorcycles
            ? `${inv.motorcycles.make ?? ""} ${inv.motorcycles.model ?? ""}`.trim()
            : "";
          const meta = invoiceStatusMeta(
            String(inv.status ?? ""),
            Number(inv.paid_amount ?? 0),
            Number(inv.total ?? 0),
          );
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
                <span
                  className={`inline-block rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider ${meta.className}`}
                >
                  {meta.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
