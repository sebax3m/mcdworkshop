import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { fullBike } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/insurance/new")({
  component: NewClaim,
});

function NewClaim() {
  const nav = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [bikeId, setBikeId] = useState<string | null>(null);
  const [insurer, setInsurer] = useState("");
  const [insurerRef, setInsurerRef] = useState("");
  const [dateReceived, setDateReceived] = useState(today);
  const [notes, setNotes] = useState("");
  const [bikeWithCustomer, setBikeWithCustomer] = useState(false);
  const [expectedReturn, setExpectedReturn] = useState<string>("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const customers = useQuery({
    queryKey: ["ins-customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("first_name")).data ?? [],
  });
  const bikes = useQuery({
    queryKey: ["ins-bikes", customerId],
    enabled: !!customerId,
    queryFn: async () => (await supabase.from("motorcycles").select("*").eq("customer_id", customerId!)).data ?? [],
  });

  const filteredCust = useMemo(() => {
    const s = search.toLowerCase().trim();
    const list = customers.data ?? [];
    if (!s) return list;
    return list.filter((c: any) =>
      `${c.first_name} ${c.last_name} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(s),
    );
  }, [customers.data, search]);

  async function save() {
    if (!customerId || !bikeId) return toast.error("Pick a customer and bike");
    setSaving(true);
    try {
      const { data, error } = await (supabase as any)
        .from("insurance_claims")
        .insert({
          customer_id: customerId,
          motorcycle_id: bikeId,
          insurer_name: insurer || null,
          insurer_claim_ref: insurerRef || null,
          date_received: dateReceived,
          bike_with_customer: bikeWithCustomer,
          expected_return_date: bikeWithCustomer && expectedReturn ? expectedReturn : null,
          notes: notes || null,
          status: "intake",
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Claim created");
      nav({ to: "/insurance/$claimId", params: { claimId: data.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create claim");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <header className="flex items-center gap-3">
        <Link to="/insurance" className="grid h-9 w-9 place-items-center rounded-lg border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Insurance</div>
          <h1 className="font-display text-2xl font-bold">New Claim</h1>
        </div>
      </header>

      <section className="card-surface p-4 space-y-3">
        <Label>Customer</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer…"
            className="w-full rounded-xl bg-card border border-border pl-10 pr-3 py-2.5 text-sm"
          />
        </div>
        <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {filteredCust.slice(0, 50).map((c: any) => (
            <button
              key={c.id}
              onClick={() => { setCustomerId(c.id); setBikeId(null); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${customerId === c.id ? "bg-primary/10 text-primary" : ""}`}
            >
              {c.first_name} {c.last_name} <span className="text-muted-foreground">· {c.phone ?? "—"}</span>
            </button>
          ))}
          {filteredCust.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No customers.</div>}
        </div>
      </section>

      {customerId && (
        <section className="card-surface p-4 space-y-2">
          <Label>Motorcycle</Label>
          {(bikes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No bikes for this customer.</p>
          ) : (
            <div className="space-y-1.5">
              {(bikes.data ?? []).map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => setBikeId(b.id)}
                  className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${bikeId === b.id ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {fullBike(b)} {b.rego ? <span className="text-muted-foreground">· {b.rego}</span> : null}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="card-surface p-4 grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Insurer</Label>
          <Input value={insurer} onChange={(e) => setInsurer(e.target.value)} placeholder="e.g. AA Insurance" />
        </div>
        <div>
          <Label>Insurer claim reference</Label>
          <Input value={insurerRef} onChange={(e) => setInsurerRef(e.target.value)} placeholder="e.g. CLM-1234567" />
        </div>
        <div>
          <Label>Date received</Label>
          <Input type="date" value={dateReceived} onChange={(e) => setDateReceived(e.target.value)} />
        </div>
        <div>
          <Label className="flex items-center gap-2 mt-6">
            <input type="checkbox" checked={bikeWithCustomer} onChange={(e) => setBikeWithCustomer(e.target.checked)} />
            Bike currently with customer
          </Label>
        </div>
        {bikeWithCustomer && (
          <div className="sm:col-span-2">
            <Label>Expected return date</Label>
            <Input type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label>Notes / damage description</Label>
          <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Front fairing cracked, mirror broken, scratches on tank…" />
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gold-surface h-11 px-6 font-bold">
          {saving ? "Creating…" : "Create claim"}
        </Button>
      </div>
    </div>
  );
}
