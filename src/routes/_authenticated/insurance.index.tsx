import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ShieldCheck, Search, Phone, Bike as BikeIcon, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CLAIM_STATUS_META, type ClaimStatus } from "@/lib/insurance";

export const Route = createFileRoute("/_authenticated/insurance/")({
  component: InsuranceList,
});

function InsuranceList() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | ClaimStatus>("open");

  const claims = useQuery({
    queryKey: ["insurance-claims"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("insurance_claims")
        .select(
          "id, claim_number, insurer_name, insurer_claim_ref, status, date_received, bike_with_customer, expected_return_date, quote_amount, approved_amount, job_id, customers(first_name,last_name,phone), motorcycles(year,make,model,rego)",
        )
        .order("date_received", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const list = useMemo(() => {
    const search = q.toLowerCase().trim();
    return (claims.data ?? []).filter((c: any) => {
      if (statusFilter === "open" && c.status === "closed") return false;
      if (statusFilter !== "all" && statusFilter !== "open" && c.status !== statusFilter) return false;
      if (!search) return true;
      const hay = [
        c.claim_number,
        c.insurer_name,
        c.insurer_claim_ref,
        c.customers ? `${c.customers.first_name} ${c.customers.last_name}` : "",
        c.motorcycles ? `${c.motorcycles.make} ${c.motorcycles.model} ${c.motorcycles.rego ?? ""}` : "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(search);
    });
  }, [claims.data, q, statusFilter]);

  const statusOptions: Array<{ k: typeof statusFilter; label: string }> = [
    { k: "open", label: "Open" },
    { k: "all", label: "All" },
    { k: "quote_in_progress", label: "Quoting" },
    { k: "quote_sent", label: "Sent" },
    { k: "approved", label: "Approved" },
    { k: "declined", label: "Declined" },
    { k: "in_repair", label: "In repair" },
    { k: "ready_for_pickup", label: "Ready" },
    { k: "closed", label: "Closed" },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <header className="flex items-center gap-3 flex-wrap">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Workshop</div>
          <h1 className="font-display text-2xl font-bold">Insurance Claims</h1>
        </div>
        <Link
          to="/insurance/new"
          className="inline-flex items-center gap-2 rounded-xl red-surface px-4 py-2.5 text-sm font-bold hover:scale-[1.02] transition-transform"
        >
          <Plus className="h-4 w-4" /> New Claim
        </Link>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search claim #, insurer, customer, bike, rego…"
            className="w-full rounded-xl bg-card border border-border pl-10 pr-3 py-2.5 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {statusOptions.map((o) => (
            <button
              key={o.k}
              onClick={() => setStatusFilter(o.k)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                statusFilter === o.k
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {claims.isLoading ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : list.length === 0 ? (
        <div className="card-surface p-10 text-center space-y-3">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No claims yet.</p>
          <Link to="/insurance/new" className="inline-flex items-center gap-2 rounded-lg red-surface px-3 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Create the first claim
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((c: any) => {
            const meta = CLAIM_STATUS_META[c.status as ClaimStatus];
            const bike = c.motorcycles
              ? `${c.motorcycles.year ?? ""} ${c.motorcycles.make ?? ""} ${c.motorcycles.model ?? ""}`.trim()
              : "—";
            const cust = c.customers ? `${c.customers.first_name} ${c.customers.last_name}` : "—";
            return (
              <Link
                key={c.id}
                to="/insurance/$claimId"
                params={{ claimId: c.id }}
                className="card-surface block p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="font-display text-base font-bold">{c.claim_number}</div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta?.cls}`}>
                    {meta?.label ?? c.status}
                  </span>
                  {c.bike_with_customer && (
                    <span className="inline-flex items-center rounded-full border border-status-parts/40 bg-status-parts/10 text-status-parts px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                      Bike with customer
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    Received {format(new Date(c.date_received), "d MMM yyyy")}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="flex items-center gap-1.5"><BikeIcon className="h-3.5 w-3.5 text-muted-foreground" /> {bike} {c.motorcycles?.rego ? `· ${c.motorcycles.rego}` : ""}</div>
                  <div>{cust} {c.customers?.phone ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {c.customers.phone}</span> : null}</div>
                  <div className="text-muted-foreground">Insurer: <span className="text-foreground">{c.insurer_name ?? "—"}</span>{c.insurer_claim_ref ? <span className="text-muted-foreground"> · ref {c.insurer_claim_ref}</span> : null}</div>
                  <div className="text-muted-foreground">
                    Quote: <span className="text-foreground font-mono">{c.quote_amount != null ? `$${Number(c.quote_amount).toFixed(2)}` : "—"}</span>
                    {c.approved_amount != null && <span> · Approved <span className="text-status-ready font-mono">${Number(c.approved_amount).toFixed(2)}</span></span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
