/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Search, ShieldCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { fullBike } from "@/lib/format";
import { NZ_INSURERS } from "@/lib/nz-insurers";
import { BikeMakeModelYear } from "@/components/BikeMakeModelYear";

export const Route = createFileRoute("/_authenticated/insurance/new")({
  component: NewClaim,
});

function NewClaim() {
  const nav = useNavigate();
  const qc = useQueryClient();
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
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // New customer inline
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [savingCust, setSavingCust] = useState(false);
  const [newCust, setNewCust] = useState({ first_name: "", last_name: "", phone: "", email: "" });

  // New bike inline
  const [newBikeOpen, setNewBikeOpen] = useState(false);
  const [savingBike, setSavingBike] = useState(false);
  const [newBike, setNewBike] = useState({ make: "", model: "", year: "", rego: "", color: "" });

  const customers = useQuery({
    queryKey: ["ins-customers"],
    queryFn: async () =>
      (await supabase.from("customers").select("*").order("first_name")).data ?? [],
  });
  const bikes = useQuery({
    queryKey: ["ins-bikes", customerId],
    enabled: !!customerId,
    queryFn: async () =>
      (await supabase.from("motorcycles").select("*").eq("customer_id", customerId!)).data ?? [],
  });

  const filteredCust = useMemo(() => {
    const s = search.toLowerCase().trim();
    const list = customers.data ?? [];
    if (!s) return list;
    return list.filter((c: any) =>
      `${c.first_name} ${c.last_name} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(s),
    );
  }, [customers.data, search]);

  async function saveNewCustomer() {
    if (!newCust.first_name.trim()) return toast.error("First name required");
    setSavingCust(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          first_name: newCust.first_name.trim(),
          last_name: newCust.last_name.trim() || null,
          phone: newCust.phone.trim() || null,
          email: newCust.email.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["ins-customers"] });
      setCustomerId(data.id);
      setBikeId(null);
      setNewCust({ first_name: "", last_name: "", phone: "", email: "" });
      setNewCustOpen(false);
      setShowCustomerPicker(true);
      toast.success("Customer created");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create customer");
    } finally {
      setSavingCust(false);
    }
  }

  async function saveNewBike() {
    if (!customerId) return toast.error("Pick a customer first");
    if (!newBike.make.trim() || !newBike.model.trim())
      return toast.error("Make and model required");
    setSavingBike(true);
    try {
      const { data, error } = await (supabase as any)
        .from("motorcycles")
        .insert({
          customer_id: customerId,
          make: newBike.make.trim(),
          model: newBike.model.trim(),
          year: newBike.year ? Number(newBike.year) : null,
          rego: newBike.rego.trim().toUpperCase() || null,
          color: newBike.color.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["ins-bikes", customerId] });
      setBikeId(data.id);
      setNewBike({ make: "", model: "", year: "", rego: "", color: "" });
      setNewBikeOpen(false);
      toast.success("Bike added");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add bike");
    } finally {
      setSavingBike(false);
    }
  }

  async function save() {
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
        <Link
          to="/insurance"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border"
        >
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <Label className="text-base">Customer & bike</Label>
            <p className="text-xs text-muted-foreground">Optional — you can link them later.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCustomerPicker((v) => !v);
            }}
            className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
          >
            {showCustomerPicker ? "Hide" : customerId ? "Change" : "Pick now"}
          </button>
        </div>
        {customerId && !showCustomerPicker && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
            {(() => {
              const c = (customers.data ?? []).find((x: any) => x.id === customerId);
              const b = (bikes.data ?? []).find((x: any) => x.id === bikeId);
              return (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span>
                    <b>
                      {c?.first_name} {c?.last_name}
                    </b>
                    {b ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {fullBike(b)}
                        {b.rego ? ` · ${b.rego}` : ""}
                      </span>
                    ) : (
                      <span className="text-amber-400"> · no bike picked</span>
                    )}
                  </span>
                  <button
                    onClick={() => {
                      setCustomerId(null);
                      setBikeId(null);
                    }}
                    className="text-[11px] uppercase tracking-wider text-destructive hover:underline"
                  >
                    Clear
                  </button>
                </div>
              );
            })()}
          </div>
        )}
        {showCustomerPicker && (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search customer…"
                  className="w-full rounded-xl bg-card border border-border pl-10 pr-3 py-2.5 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setNewCustOpen((o) => !o)}
                className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 text-primary px-3 py-2 text-xs font-semibold hover:bg-primary/20 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" /> New customer
              </button>
            </div>
            {newCustOpen && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  New customer
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="First name *"
                    value={newCust.first_name}
                    onChange={(e) => setNewCust({ ...newCust, first_name: e.target.value })}
                  />
                  <Input
                    placeholder="Last name (optional)"
                    value={newCust.last_name}
                    onChange={(e) => setNewCust({ ...newCust, last_name: e.target.value })}
                  />
                  <Input
                    placeholder="Phone"
                    inputMode="tel"
                    value={newCust.phone}
                    onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                  />
                  <Input
                    placeholder="Email (optional)"
                    inputMode="email"
                    value={newCust.email}
                    onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={saveNewCustomer}
                    disabled={savingCust}
                    className="gold-surface flex-1"
                  >
                    {savingCust ? "Saving…" : "Save customer"}
                  </Button>
                  <Button variant="ghost" onClick={() => setNewCustOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {filteredCust.slice(0, 50).map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCustomerId(c.id);
                    setBikeId(null);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${customerId === c.id ? "bg-primary/10 text-primary" : ""}`}
                >
                  {c.first_name} {c.last_name}{" "}
                  <span className="text-muted-foreground">· {c.phone ?? "—"}</span>
                </button>
              ))}
              {filteredCust.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No customers.</div>
              )}
            </div>
            {customerId && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Motorcycle</Label>
                  <button
                    type="button"
                    onClick={() => setNewBikeOpen((o) => !o)}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold hover:bg-primary/20"
                  >
                    <Plus className="h-3 w-3" /> New bike
                  </button>
                </div>
                {newBikeOpen && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <BikeMakeModelYear
                      value={{ make: newBike.make, model: newBike.model, year: newBike.year }}
                      onChange={(v) =>
                        setNewBike({ ...newBike, make: v.make, model: v.model, year: v.year })
                      }
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Rego"
                        value={newBike.rego}
                        onChange={(e) =>
                          setNewBike({ ...newBike, rego: e.target.value.toUpperCase() })
                        }
                      />
                      <Input
                        placeholder="Colour"
                        value={newBike.color}
                        onChange={(e) => setNewBike({ ...newBike, color: e.target.value })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={saveNewBike}
                        disabled={savingBike}
                        className="gold-surface flex-1"
                      >
                        {savingBike ? "Saving…" : "Save bike"}
                      </Button>
                      <Button variant="ghost" onClick={() => setNewBikeOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {(bikes.data ?? []).length === 0 && !newBikeOpen ? (
                  <p className="text-sm text-muted-foreground">
                    No bikes for this customer — add one above.
                  </p>
                ) : (
                  (bikes.data ?? []).map((b: any) => (
                    <button
                      key={b.id}
                      onClick={() => setBikeId(b.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${bikeId === b.id ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      {fullBike(b)}{" "}
                      {b.rego ? <span className="text-muted-foreground">· {b.rego}</span> : null}
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section className="card-surface p-4 grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Insurer</Label>
          <Input
            list="nz-insurers"
            value={insurer}
            onChange={(e) => setInsurer(e.target.value)}
            placeholder="Select or type insurer…"
          />
          <datalist id="nz-insurers">
            {NZ_INSURERS.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div>
          <Label>Insurer claim reference</Label>
          <Input
            value={insurerRef}
            onChange={(e) => setInsurerRef(e.target.value)}
            placeholder="e.g. CLM-1234567"
          />
        </div>
        <div>
          <Label>Date received</Label>
          <Input
            type="date"
            value={dateReceived}
            onChange={(e) => setDateReceived(e.target.value)}
          />
        </div>
        <div>
          <Label className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              checked={bikeWithCustomer}
              onChange={(e) => setBikeWithCustomer(e.target.checked)}
            />
            Bike currently with customer
          </Label>
        </div>
        {bikeWithCustomer && (
          <div className="sm:col-span-2">
            <Label>Expected return date</Label>
            <Input
              type="date"
              value={expectedReturn}
              onChange={(e) => setExpectedReturn(e.target.value)}
            />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label>Notes / damage description</Label>
          <Textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Front fairing cracked, mirror broken, scratches on tank…"
          />
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
