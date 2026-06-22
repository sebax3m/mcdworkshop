import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bike as BikeIcon, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { fullBike } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/motorcycles")({
  component: Bikes,
});

function Bikes() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ customer_id: "", make: "", model: "", year: "", vin: "", rego: "", mileage: "", ecu_info: "", modifications: "" });

  const customers = useQuery({ queryKey: ["customers-options"], queryFn: async () => (await supabase.from("customers").select("id, first_name, last_name").order("first_name")).data ?? [] });
  const bikes = useQuery({
    queryKey: ["bikes-list"],
    queryFn: async () => (await supabase.from("motorcycles").select("*, customers(first_name,last_name)").order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = (bikes.data ?? []).filter((b: any) => {
    const s = `${b.make} ${b.model} ${b.year ?? ""} ${b.rego ?? ""} ${b.customers?.first_name ?? ""} ${b.customers?.last_name ?? ""}`.toLowerCase();
    return s.includes(search.toLowerCase());
  });

  async function save() {
    if (!f.customer_id) return toast.error("Pick a customer");
    if (!f.make || !f.model) return toast.error("Make and model required");
    const payload: any = { ...f, year: f.year ? parseInt(f.year) : null, mileage: f.mileage ? parseInt(f.mileage) : null };
    const { error } = await supabase.from("motorcycles").insert(payload);
    if (error) return toast.error(error.message);
    setF({ customer_id: "", make: "", model: "", year: "", vin: "", rego: "", mileage: "", ecu_info: "", modifications: "" });
    setOpen(false);
    toast.success("Bike added");
    qc.invalidateQueries({ queryKey: ["bikes-list"] });
  }

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Garage</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{bikes.data?.length ?? 0} bikes</h1>
        </div>
        <Button onClick={() => setOpen((o) => !o)} className="gold-surface gap-1.5 shrink-0"><Plus className="h-4 w-4" /> Add</Button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search make, model, rego, owner" className="w-full rounded-xl bg-card border border-border pl-10 pr-3 py-3 text-sm" />
      </div>

      {open && (
        <div className="card-surface p-4 space-y-3">
          <select value={f.customer_id} onChange={(e) => setF({ ...f, customer_id: e.target.value })} className="w-full rounded-md bg-input border border-border px-3 py-2 text-sm">
            <option value="">Select customer…</option>
            {(customers.data ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Make *" value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} />
            <Input placeholder="Model *" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Year" inputMode="numeric" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} />
            <Input placeholder="Rego" value={f.rego} onChange={(e) => setF({ ...f, rego: e.target.value.toUpperCase() })} />
            <Input placeholder="km" inputMode="numeric" value={f.mileage} onChange={(e) => setF({ ...f, mileage: e.target.value })} />
          </div>
          <Input placeholder="VIN" value={f.vin} onChange={(e) => setF({ ...f, vin: e.target.value })} />
          <Input placeholder="ECU info" value={f.ecu_info} onChange={(e) => setF({ ...f, ecu_info: e.target.value })} />
          <Textarea placeholder="Modifications" rows={2} value={f.modifications} onChange={(e) => setF({ ...f, modifications: e.target.value })} />
          <Button onClick={save} className="gold-surface w-full">Save bike</Button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((b: any) => (
          <div key={b.id} className="card-surface p-3 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-muted"><BikeIcon className="h-5 w-5 text-primary" /></span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{fullBike(b)}</div>
              <div className="text-xs text-muted-foreground truncate">
                {b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : "—"}
                {b.rego ? ` · ${b.rego}` : ""}
                {b.mileage ? ` · ${b.mileage} km` : ""}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="card-surface p-8 text-center text-sm text-muted-foreground">No bikes yet.</div>}
      </div>
    </div>
  );
}