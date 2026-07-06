import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Package, Plus, Search, AlertTriangle, LayoutGrid, List, Rows3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: Inventory,
});

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "oil", label: "Oil" },
  { key: "oil_filter", label: "Oil filters" },
  { key: "air_filter", label: "Air filters" },
  { key: "spark_plug", label: "Spark plugs" },
  { key: "brake_pad", label: "Brake pads" },
  { key: "brake_fluid", label: "Brake fluid" },
  { key: "coolant", label: "Coolant" },
  { key: "chain", label: "Chains" },
  { key: "sprocket", label: "Sprockets" },
  { key: "other", label: "Other" },
];

type ViewMode = "grid" | "list" | "compact";

function Inventory() {
  const { isAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem("inventory-view") as ViewMode) || "grid";
  });

  function changeView(v: ViewMode) {
    setView(v);
    if (typeof window !== "undefined") localStorage.setItem("inventory-view", v);
  }

  const items = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => (await supabase.from("inventory_items").select("*").order("category").order("name")).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return (items.data ?? []).filter((i: any) => {
      if (cat !== "all" && i.category !== cat) return false;
      if (!s) return true;
      return `${i.name} ${i.brand ?? ""} ${i.type ?? ""} ${i.sku ?? ""}`.toLowerCase().includes(s);
    });
  }, [items.data, cat, search]);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <header className="flex items-center gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Workshop</div>
          <h1 className="font-display text-2xl font-bold">Inventory</h1>
        </div>
        {isAdmin && (
          <Button onClick={() => setEditing({})} className="gold-surface gap-2">
            <Plus className="h-4 w-4" /> Add item
          </Button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2 flex-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCat(c.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                cat === c.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-border overflow-hidden shrink-0">
          {([
            { k: "grid", icon: LayoutGrid, label: "Grid" },
            { k: "list", icon: List, label: "List" },
            { k: "compact", icon: Rows3, label: "Compact" },
          ] as const).map(({ k, icon: Icon, label }) => (
            <button
              key={k}
              onClick={() => changeView(k)}
              title={label}
              aria-label={label}
              className={`px-2.5 py-1.5 transition-colors ${
                view === k ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, brand, SKU"
          className="w-full rounded-xl bg-card border border-border pl-10 pr-3 py-3 text-sm"
        />
      </div>

      {items.isLoading ? (
        <div className="card-surface p-8 text-center text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-surface p-8 text-center text-muted-foreground">No inventory items.</div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((i: any) => {
            const low = Number(i.stock_qty) <= Number(i.min_stock);
            return (
              <button
                key={i.id}
                onClick={() => isAdmin && setEditing(i)}
                disabled={!isAdmin}
                className="card-surface p-3 text-left hover:border-primary/40 transition-colors disabled:cursor-default flex flex-col items-center text-center gap-2"
              >
                <span className="grid h-14 w-14 place-items-center rounded-xl bg-muted text-primary">
                  <Package className="h-7 w-7" />
                </span>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{i.category}</div>
                <div className="font-semibold text-sm truncate w-full">{i.name}</div>
                <div className="text-xs text-muted-foreground truncate w-full">
                  {[i.brand, i.type].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="mt-auto pt-1 flex items-center justify-between w-full text-xs">
                  <span className={low ? "text-destructive font-bold" : "font-bold"}>
                    {Number(i.stock_qty)} {i.unit}
                  </span>
                  <span className="font-semibold text-primary">${Number(i.unit_price).toFixed(2)}</span>
                </div>
                {low && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px] font-bold uppercase">
                    <AlertTriangle className="h-3 w-3" /> Low
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : view === "list" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((i: any) => {
            const low = Number(i.stock_qty) <= Number(i.min_stock);
            return (
              <button
                key={i.id}
                onClick={() => isAdmin && setEditing(i)}
                disabled={!isAdmin}
                className="card-surface p-4 text-left hover:border-primary/40 transition-colors disabled:cursor-default"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-primary shrink-0">
                    <Package className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{i.category}</span>
                      {low && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px] font-bold uppercase">
                          <AlertTriangle className="h-3 w-3" /> Low
                        </span>
                      )}
                    </div>
                    <div className="font-semibold truncate">{i.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[i.brand, i.type].filter(Boolean).join(" · ") || "—"}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span>
                        <span className="font-bold text-foreground">{Number(i.stock_qty)}</span>
                        <span className="text-muted-foreground"> {i.unit} in stock</span>
                      </span>
                      <span className="font-semibold text-primary">${Number(i.unit_price).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="card-surface overflow-hidden divide-y divide-border">
          {filtered.map((i: any) => {
            const low = Number(i.stock_qty) <= Number(i.min_stock);
            return (
              <button
                key={i.id}
                onClick={() => isAdmin && setEditing(i)}
                disabled={!isAdmin}
                className="w-full px-4 py-2.5 text-left hover:bg-muted/40 transition-colors disabled:cursor-default flex items-center gap-3"
              >
                <Package className="h-4 w-4 text-primary shrink-0" />
                <span className="font-semibold text-sm truncate flex-1">{i.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline w-24 truncate">{i.category}</span>
                <span className="text-xs text-muted-foreground hidden md:inline w-40 truncate">
                  {[i.brand, i.type].filter(Boolean).join(" · ") || "—"}
                </span>
                <span className={`text-xs w-20 text-right ${low ? "text-destructive font-bold" : "font-bold"}`}>
                  {Number(i.stock_qty)} {i.unit}
                </span>
                <span className="text-xs font-semibold text-primary w-16 text-right">${Number(i.unit_price).toFixed(2)}</span>
                {low && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {editing && (
        <EditDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["inventory"] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditDialog({ item, onClose, onSaved }: { item: any; onClose: () => void; onSaved: () => void }) {
  const isNew = !item?.id;
  const [form, setForm] = useState<any>({
    name: item?.name ?? "",
    category: item?.category ?? "oil",
    brand: item?.brand ?? "",
    type: item?.type ?? "",
    unit: item?.unit ?? "unit",
    unit_price: item?.unit_price ?? 0,
    stock_qty: item?.stock_qty ?? 0,
    min_stock: item?.min_stock ?? 0,
    sku: item?.sku ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name.trim()) return toast.error("Name required");
    setSaving(true);
    const payload = { ...form, unit_price: Number(form.unit_price), stock_qty: Number(form.stock_qty), min_stock: Number(form.min_stock) };
    const { error } = isNew
      ? await supabase.from("inventory_items").insert(payload)
      : await supabase.from("inventory_items").update(payload).eq("id", item.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isNew ? "Item added" : "Item updated");
    onSaved();
  }

  async function remove() {
    if (isNew || !confirm("Delete this item?")) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4" onClick={onClose}>
      <div className="card-surface p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold">{isNew ? "Add inventory item" : "Edit item"}</h3>
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full h-10 rounded-md bg-background border border-border px-3 text-sm">
              {CATEGORIES.filter((c) => c.key !== "all").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
          <Field label="Type"><Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price"><Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></Field>
          <Field label="Stock"><Input type="number" step="0.01" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} /></Field>
          <Field label="Min"><Input type="number" step="0.01" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></Field>
        </div>
        <Field label="SKU"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
        <div className="flex gap-2 pt-2">
          {!isNew && <Button variant="outline" onClick={remove} className="text-destructive border-destructive/40">Delete</Button>}
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="gold-surface">{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      {children}
    </label>
  );
}