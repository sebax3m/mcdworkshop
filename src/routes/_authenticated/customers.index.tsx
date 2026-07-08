import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Phone, Mail, ChevronRight, Bike } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/customers/")({
  component: Customers,
});

function Customers() {
  const qc = useQueryClient();
  const { isAdmin } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ first_name: "", last_name: "", phone: "", email: "", address: "", notes: "" });

  const customers = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => (await supabase.from("customers").select("*").order("created_at", { ascending: false }).range(0, 49999)).data ?? [],
  });

  const bikes = useQuery({
    queryKey: ["customers-bikes"],
    queryFn: async () => (await supabase.from("motorcycles").select("id, customer_id, make, model, year, rego")).data ?? [],
  });

  const bikesByCustomer = new Map<string, any[]>();
  for (const b of bikes.data ?? []) {
    const arr = bikesByCustomer.get(b.customer_id) ?? [];
    arr.push(b);
    bikesByCustomer.set(b.customer_id, arr);
  }

  async function save() {
    if (!f.first_name.trim()) return toast.error("First name required");
    const payload = { ...f, last_name: f.last_name.trim() || null };
    const { error } = await supabase.from("customers").insert(payload);
    if (error) return toast.error(error.message);
    setF({ first_name: "", last_name: "", phone: "", email: "", address: "", notes: "" });
    setOpen(false);
    toast.success("Customer added");
    qc.invalidateQueries({ queryKey: ["customers-list"] });
  }

  const filtered = (customers.data ?? []).filter((c: any) =>
    `${c.first_name} ${c.last_name} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Customers</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">{customers.data?.length ?? 0} riders</h1>
        </div>
        <Button onClick={() => setOpen((o) => !o)} className="gold-surface gap-1.5 shrink-0"><Plus className="h-4 w-4" /> Add</Button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, email" className="w-full rounded-xl bg-card border border-border pl-10 pr-3 py-3 text-sm" />
      </div>

      {open && (
        <div className="card-surface p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="First name *" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
            <Input placeholder="Last name (optional)" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
          </div>
          <Input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <Input placeholder="Email (optional)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <Input placeholder="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          <Textarea placeholder="Notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          <Button onClick={save} className="gold-surface w-full">Save customer</Button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((c: any) => {
          const cBikes = bikesByCustomer.get(c.id) ?? [];
          return (
            <Link
              key={c.id}
              to="/customers/$customerId"
              params={{ customerId: c.id }}
              className="card-surface p-3 flex items-center gap-3 hover:border-primary/50 transition-colors"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-muted font-semibold">{initials(`${c.first_name} ${c.last_name ?? ""}`)}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{c.first_name}{c.last_name ? ` ${c.last_name}` : ""}</div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  {c.email && <span className="inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{c.email}</span>}
                </div>
                {cBikes.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {cBikes.map((b) => (
                      <span key={b.id} className="inline-flex items-center gap-1 rounded-md bg-muted/60 border border-border/60 px-1.5 py-0.5 text-[10px] text-foreground/80">
                        <Bike className="h-3 w-3 text-primary" />
                        {b.make} {b.model}{b.year ? ` ${b.year}` : ""}{b.rego ? ` · ${b.rego}` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          );
        })}
        {filtered.length === 0 && <div className="card-surface p-8 text-center text-sm text-muted-foreground">No customers yet.</div>}
      </div>
    </div>
  );
}