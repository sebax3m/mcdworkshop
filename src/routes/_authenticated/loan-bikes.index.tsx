import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bike as BikeIcon, ChevronRight, Plus, CalendarClock, Wrench, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/loan-bikes/")({
  component: LoanBikesIndex,
});

type BikeRow = {
  id: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  rego: string | null;
  current_km: number;
  service_interval_km: number;
  last_service_km: number | null;
  last_service_date: string | null;
  active: boolean;
};

function LoanBikesIndex() {
  const [creating, setCreating] = useState(false);
  const [nName, setNName] = useState("");
  const [nMake, setNMake] = useState("");
  const [nModel, setNModel] = useState("");
  const [nColor, setNColor] = useState("");
  const [nRego, setNRego] = useState("");
  const [saving, setSaving] = useState(false);

  const bikes = useQuery({
    queryKey: ["loan-bikes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loan_bikes")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as BikeRow[];
    },
  });

  const assignments = useQuery({
    queryKey: ["loan-bikes-active-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, loan_bike_id, scheduled_date, loan_bike_expected_return, loan_bike_returned_at, job_id, customers(first_name,last_name)")
        .not("loan_bike_id", "is", null)
        .is("loan_bike_returned_at", null);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const currentByBike = new Map<string, any>();
  (assignments.data ?? []).forEach((a) => {
    if (!currentByBike.has(a.loan_bike_id)) currentByBike.set(a.loan_bike_id, a);
  });

  async function createBike() {
    if (!nName.trim()) return toast.error("Name required");
    setSaving(true);
    try {
      const { error } = await supabase.from("loan_bikes").insert({
        name: nName.trim(),
        make: nMake || null,
        model: nModel || null,
        color: nColor || null,
        rego: nRego || null,
      });
      if (error) throw error;
      toast.success("Loan bike added");
      setCreating(false);
      setNName(""); setNMake(""); setNModel(""); setNColor(""); setNRego("");
      bikes.refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Fleet</div>
          <h1 className="font-display text-2xl font-bold">Loan Bikes</h1>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl gold-surface px-4 h-10 text-sm font-bold"
        >
          <Plus className="h-4 w-4" /> Add bike
        </button>
      </header>

      {bikes.isLoading ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (bikes.data ?? []).length === 0 ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">No loan bikes yet.</div>
      ) : (
        <div className="space-y-2">
          {(bikes.data ?? []).map((b) => {
            const current = currentByBike.get(b.id);
            const nextServiceKm = (b.last_service_km ?? 0) + (b.service_interval_km || 5000);
            const kmToService = nextServiceKm - b.current_km;
            const serviceSoon = kmToService <= 500;
            const isOut = !!current;
            return (
              <Link
                key={b.id}
                to="/loan-bikes/$bikeId"
                params={{ bikeId: b.id }}
                className="w-full card-surface p-4 flex items-center gap-3 hover:border-primary/50 transition-colors"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-400">
                  <BikeIcon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{b.name}</span>
                    {b.rego && <span className="text-[10px] text-muted-foreground">· {b.rego}</span>}
                    {isOut ? (
                      <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Out</span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/15 text-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Available</span>
                    )}
                    {serviceSoon && (
                      <span className="rounded-full bg-amber-400/15 text-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                        <Wrench className="h-3 w-3" /> Service due
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>{b.current_km.toLocaleString()} km</span>
                    <span>Next service @ {nextServiceKm.toLocaleString()} km</span>
                    {isOut && (
                      <>
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          {current.customers ? `${current.customers.first_name} ${current.customers.last_name}` : "—"}
                        </span>
                        {current.loan_bike_expected_return && (
                          <span className="inline-flex items-center gap-1 text-amber-400">
                            <CalendarClock className="h-3 w-3" />
                            Back {format(new Date(current.loan_bike_expected_return + "T00:00:00"), "EEE d MMM")}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add loan bike</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="e.g. Yamaha MT-07" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Make</Label><Input value={nMake} onChange={(e) => setNMake(e.target.value)} /></div>
              <div><Label>Model</Label><Input value={nModel} onChange={(e) => setNModel(e.target.value)} /></div>
              <div><Label>Colour</Label><Input value={nColor} onChange={(e) => setNColor(e.target.value)} /></div>
              <div><Label>Rego</Label><Input value={nRego} onChange={(e) => setNRego(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button onClick={createBike} disabled={saving}>{saving ? "Saving…" : "Add bike"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
