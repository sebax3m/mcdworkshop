/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, PackageSearch, Pencil, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge, statusPatch, useInvalidateParts } from "@/lib/parts-orders";
import { PartEditDialog } from "@/components/parts/PartEditDialog";
import { fmtD } from "@/components/parts/fmt";

const money = (v: any) => (v == null ? "—" : `$${Number(v).toFixed(2)}`);

/** Loads the claim's parts orders (same table as Main Menu → Parts Orders). */
export function useClaimParts(claimId: string) {
  return useQuery({
    queryKey: ["claim-parts", claimId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_parts")
        .select("*")
        .eq("claim_id", claimId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/** Creates order rows for quote parts that don't have one yet (no duplicates). */
export async function syncClaimPartsFromQuote(claim: any): Promise<number> {
  const items: any[] = Array.isArray(claim.quote_items) ? claim.quote_items : [];
  const parts = items.filter((it) => it.kind !== "labour" && it.id);
  if (!parts.length) return 0;
  const { data: existing } = await supabase
    .from("booking_parts")
    .select("quote_item_id")
    .eq("claim_id", claim.id);
  const have = new Set((existing ?? []).map((r: any) => r.quote_item_id));
  const rows = parts
    .filter((it) => !have.has(it.id))
    .map((it, i) => ({
      claim_id: claim.id,
      quote_item_id: String(it.id),
      description: [it.item_name, it.description].filter(Boolean).join(" — ") || "Part",
      part_number: it.item_code || null,
      qty_required: Math.max(1, Math.round(Number(it.qty) || 1)),
      sell_price: it.unit_price != null ? Number(it.unit_price) : null,
      status: "needs_ordering",
      source: "insurance",
      sort_order: i,
    }));
  if (!rows.length) return 0;
  const { error } = await supabase.from("booking_parts").insert(rows);
  if (error) throw error;
  return rows.length;
}

export function ClaimPartsTracking({ claim }: { claim: any }) {
  const q = useClaimParts(claim.id);
  const invalidate = useInvalidateParts();
  const [edit, setEdit] = useState<any | null | undefined>(undefined);
  const [syncing, setSyncing] = useState(false);
  const rows = q.data ?? [];

  async function sync() {
    setSyncing(true);
    try {
      const n = await syncClaimPartsFromQuote(claim);
      toast.success(n ? `${n} part${n === 1 ? "" : "s"} added — ready to order` : "All quote parts already have an order");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create orders");
    } finally {
      setSyncing(false);
    }
  }

  async function quick(p: any, status: any) {
    const { error } = await supabase.from("booking_parts").update(statusPatch(p, status)).eq("id", p.id);
    if (error) return toast.error(error.message);
    invalidate();
  }

  const link = (url: string | null, label: string) =>
    url ? (
      <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-300 underline">
        {label} <ExternalLink className="h-3 w-3" />
      </a>
    ) : (
      label
    );

  return (
    <section className="card-surface p-4 space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <PackageSearch className="h-5 w-5 text-sky-400" />
        <h2 className="font-display text-lg font-bold">Parts Order Tracking</h2>
        <span className="text-xs text-muted-foreground">{rows.length} part{rows.length === 1 ? "" : "s"}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link
            to="/parts-orders"
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 h-8 text-xs font-semibold hover:border-primary/50"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Parts Orders
          </Link>
          <button
            onClick={sync}
            disabled={syncing}
            className="inline-flex items-center gap-1 rounded-md border border-sky-500/60 px-2.5 h-8 text-xs font-bold uppercase text-sky-300 hover:bg-sky-500/10 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Create from quote
          </button>
          <button
            onClick={() => setEdit(null)}
            className="inline-flex items-center gap-1 rounded-md red-surface px-2.5 h-8 text-xs font-bold uppercase"
          >
            <Plus className="h-3.5 w-3.5" /> Add order
          </button>
        </div>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No parts orders yet. They are created automatically when the claim is approved, or use “Create from quote”.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                {["Part", "Part #", "Qty", "Supplier", "Order ref", "Ordered", "Cost", "Sell", "Status", "ETA", "Tracking", "Notes", ""].map((h) => (
                  <th key={h} className="px-2 py-2 text-left font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/40">
                  <td className="px-2 py-1.5 font-semibold">{r.description}</td>
                  <td className="px-2 py-1.5 font-mono">{r.part_number}</td>
                  <td className="px-2 py-1.5 tabular-nums">{r.qty_received}/{r.qty_required}</td>
                  <td className="px-2 py-1.5">{r.supplier}</td>
                  <td className="px-2 py-1.5 font-mono">{r.order_ref}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{fmtD(r.ordered_at)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{money(r.cost)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{money(r.sell_price)}</td>
                  <td className="px-2 py-1.5"><StatusBadge status={r.status} /></td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{fmtD(r.eta)}</td>
                  <td className="px-2 py-1.5">
                    {r.tracking_number || r.tracking_url ? link(r.tracking_url, r.tracking_number || "Open link") : ""}
                  </td>
                  <td className="px-2 py-1.5 max-w-[10rem] truncate" title={r.notes ?? ""}>{r.notes}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex justify-end gap-1">
                      {r.status === "needs_ordering" && (
                        <button onClick={() => setEdit({ ...r, status: "ordered" })} className="rounded-md border border-sky-500/60 px-2 h-7 text-[0.625rem] font-bold uppercase text-sky-300 hover:bg-sky-500/15 whitespace-nowrap">Ordered</button>
                      )}
                      {["ordered", "partially_shipped", "shipped", "ready_for_collection", "backordered", "partially_received"].includes(r.status) && (
                        <button onClick={() => quick(r, "arrived")} className="rounded-md border border-emerald-500/60 px-2 h-7 text-[0.625rem] font-bold uppercase text-emerald-300 hover:bg-emerald-500/15">Received</button>
                      )}
                      <button onClick={() => setEdit(r)} className="grid h-7 w-7 place-items-center rounded-md border border-border hover:border-primary/50" aria-label="Edit order">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PartEditDialog
        open={edit !== undefined}
        onOpenChange={(v) => !v && setEdit(undefined)}
        bookingId={edit?.booking_id ?? null}
        claimId={claim.id}
        part={edit ?? null}
      />
    </section>
  );
}
