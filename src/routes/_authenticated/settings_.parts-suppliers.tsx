import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Boxes, Plus, Trash2, Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SUPPLIER_SUGGESTIONS, useSupplierStats } from "@/lib/parts-orders";

export const Route = createFileRoute("/_authenticated/settings_/parts-suppliers")({
  head: () => ({
    meta: [
      { title: "Parts & Suppliers — Motorcycle Doctors Workshop" },
      {
        name: "description",
        content:
          "Browse, edit and clean up every part and supplier the workshop has learned from past orders.",
      },
      { property: "og:title", content: "Parts & Suppliers — Motorcycle Doctors" },
      {
        property: "og:description",
        content: "Browse, edit and clean up every part and supplier learned from past orders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartsSuppliersSettings,
});

type CatalogRow = {
  id: string;
  item: string | null;
  description: string;
  part_number: string | null;
  brand: string | null;
  last_supplier: string | null;
  supplier_sku: string | null;
  supplier_url: string | null;
  last_cost: number | null;
  last_sell: number | null;
  times_purchased: number;
  last_purchased_at: string | null;
  bikes: unknown;
};

const money = (n: number | null) =>
  n === null || n === undefined ? "—" : `$${Number(n).toFixed(2)}`;

function PartsSuppliersSettings() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const stats = useSupplierStats();

  const list = useQuery({
    queryKey: ["parts-catalog", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parts_catalog")
        .select(
          "id, item, description, part_number, brand, last_supplier, supplier_sku, supplier_url, last_cost, last_sell, times_purchased, last_purchased_at, bikes",
        )
        .order("last_purchased_at", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as CatalogRow[];
    },
  });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (list.data ?? []).filter((r) => {
      if (supplierFilter && (r.last_supplier ?? "") !== supplierFilter) return false;
      if (!needle) return true;
      return [r.item, r.description, r.part_number, r.brand, r.last_supplier, r.supplier_sku]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [list.data, q, supplierFilter]);

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    for (const r of list.data ?? []) if (r.last_supplier) set.add(r.last_supplier);
    return [...set].sort();
  }, [list.data]);

  const save = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CatalogRow> }) => {
      const { error } = await supabase.from("parts_catalog").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parts-catalog"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parts_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Part removed from the catalogue");
      qc.invalidateQueries({ queryKey: ["parts-catalog"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const add = useMutation({
    mutationFn: async () => {
      const key = `manual-${Date.now()}`;
      const { error } = await supabase.from("parts_catalog").insert({
        key_norm: key,
        description: "New part",
        item: "Part",
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parts-catalog"] }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });

  function cell(r: CatalogRow, field: keyof CatalogRow, placeholder: string, wide = false) {
    return (
      <input
        defaultValue={(r[field] as string | null) ?? ""}
        placeholder={placeholder}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v === (((r[field] as string | null) ?? "") as string)) return;
          save.mutate({ id: r.id, patch: { [field]: v || null } as Partial<CatalogRow> });
        }}
        className={`h-8 rounded-md border border-border bg-background px-2 text-xs ${wide ? "w-full" : "w-full"}`}
      />
    );
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Boxes className="h-5 w-5 text-primary" /> Parts &amp; Suppliers
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every part the workshop has ordered is saved here and reused as a suggestion next time.
          Fix names, codes, suppliers and prices, or delete anything that was saved by mistake.
        </p>
      </div>

      {/* Suppliers summary */}
      <div className="card-surface p-4">
        <div className="text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1.5">
          <Truck className="h-3.5 w-3.5" /> Suppliers
        </div>
        {stats.data?.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.data.map((s: any) => (
              <button
                key={s.supplier}
                onClick={() => setSupplierFilter(supplierFilter === s.supplier ? "" : s.supplier)}
                className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  supplierFilter === s.supplier
                    ? "border-primary/60 bg-primary/10"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="font-semibold">{s.supplier}</div>
                <div className="text-muted-foreground mt-0.5">
                  {s.orders} orders · {s.parts} parts
                  {s.avg_lead_days != null ? ` · ${s.avg_lead_days}d lead` : ""}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            No supplier history yet. It fills in as parts get ordered and received.
          </p>
        )}
      </div>

      {/* Search + add */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search part, code, brand or supplier…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm"
          />
        </div>
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          onClick={() => add.mutate()}
          disabled={add.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg red-surface px-3 h-9 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add part
        </button>
      </div>

      <div className="card-surface overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-left w-[13%]">Item</th>
              <th className="px-3 py-2 text-left w-[26%]">Description</th>
              <th className="px-3 py-2 text-left w-[14%]">Part number</th>
              <th className="px-3 py-2 text-left w-[11%]">Brand</th>
              <th className="px-3 py-2 text-left w-[13%]">Supplier</th>
              <th className="px-3 py-2 text-left w-[11%]">Supplier code</th>
              <th className="px-3 py-2 text-right w-[6%]">Cost</th>
              <th className="px-3 py-2 text-right w-[6%]">Sell</th>
              <th className="px-3 py-2 text-center w-[5%]">Used</th>
              <th className="px-3 py-2 w-[4%]" />
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                  Nothing here yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/50 last:border-0 align-middle">
                  <td className="px-2 py-1.5">{cell(r, "item", "Oil Filter")}</td>
                  <td className="px-2 py-1.5">{cell(r, "description", "HiFlo HF204", true)}</td>
                  <td className="px-2 py-1.5">{cell(r, "part_number", "HF204")}</td>
                  <td className="px-2 py-1.5">{cell(r, "brand", "HiFlo")}</td>
                  <td className="px-2 py-1.5">
                    <input
                      list="supplier-options"
                      defaultValue={r.last_supplier ?? ""}
                      placeholder="Darbi"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v === (r.last_supplier ?? "")) return;
                        save.mutate({ id: r.id, patch: { last_supplier: v || null } });
                      }}
                      className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">{cell(r, "supplier_sku", "SKU")}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {money(r.last_cost)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {money(r.last_sell)}
                  </td>
                  <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                    {r.times_purchased}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={() => {
                        if (!confirm(`Remove "${r.description}" from the parts catalogue?`)) return;
                        remove.mutate(r.id);
                      }}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete from catalogue"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <datalist id="supplier-options">
        {[...new Set([...SUPPLIER_SUGGESTIONS, ...suppliers])].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <p className="text-xs text-muted-foreground">
        Changes save on their own when you click outside a field. Deleting a part here only removes
        it from the suggestions list — invoices and job cards are not affected.
      </p>
    </div>
  );
}
