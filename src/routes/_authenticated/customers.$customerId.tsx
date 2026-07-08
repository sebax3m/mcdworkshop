import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Trash2, Save, Bike, Plus, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  component: CustomerProfile,
});

function CustomerProfile() {
  const { customerId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const customer = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [f, setF] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  useEffect(() => {
    if (customer.data) {
      setF({
        first_name: customer.data.first_name ?? "",
        last_name: customer.data.last_name ?? "",
        phone: customer.data.phone ?? "",
        email: customer.data.email ?? "",
        address: customer.data.address ?? "",
        notes: customer.data.notes ?? "",
      });
    }
  }, [customer.data]);

  async function save() {
    if (!f.first_name.trim()) return toast.error("First name required");
    setSaving(true);
    const { error } = await supabase
      .from("customers")
      .update({
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim() || null,
        phone: f.phone || null,
        email: f.email || null,
        address: f.address || null,
        notes: f.notes || null,
      })
      .eq("id", customerId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Customer updated");
    qc.invalidateQueries({ queryKey: ["customer", customerId] });
    qc.invalidateQueries({ queryKey: ["customers-list"] });
  }

  async function remove() {
    setDeleting(true);
    const { error } = await supabase.from("customers").delete().eq("id", customerId);
    setDeleting(false);
    if (error) {
      setConfirmDel(false);
      return toast.error(error.message);
    }
    toast.success("Customer deleted");
    qc.invalidateQueries({ queryKey: ["customers-list"] });
    navigate({ to: "/customers" });
  }

  if (customer.isLoading) {
    return <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!customer.data) {
    return (
      <div className="space-y-4">
        <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">Customer not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <Link to="/customers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Customers
        </Link>
        <Button variant="destructive" size="sm" onClick={() => setConfirmDel(true)} className="gap-1.5">
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      </div>

      <header>
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Customer</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">
          {f.first_name} {f.last_name}
        </h1>
      </header>

      <div className="card-surface p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">First name *</label>
            <Input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Last name</label>
            <Input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Phone</label>
          <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Email</label>
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Address</label>
          <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Notes</label>
          <Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>
        <Button onClick={save} disabled={saving} className="gold-surface w-full gap-1.5">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <BikesSection customerId={customerId} />


      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {f.first_name} {f.last_name}. Related bookings, bikes, or invoices
              may block deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BikesSection({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nb, setNb] = useState({ make: "", model: "", year: "", rego: "" });

  const bikes = useQuery({
    queryKey: ["customer-bikes", customerId],
    queryFn: async () =>
      (
        await supabase
          .from("motorcycles")
          .select("id, make, model, year, rego, mileage, rego_expiry, wof_expiry")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  async function addBike() {
    if (!nb.make.trim() || !nb.model.trim()) return toast.error("Make and model required");
    setBusy(true);
    const { error } = await supabase.from("motorcycles").insert({
      customer_id: customerId,
      make: nb.make.trim(),
      model: nb.model.trim(),
      year: nb.year ? parseInt(nb.year) : null,
      rego: nb.rego ? nb.rego.toUpperCase() : null,
      cylinders: 2,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Bike added");
    setNb({ make: "", model: "", year: "", rego: "" });
    setAdding(false);
    qc.invalidateQueries({ queryKey: ["customer-bikes", customerId] });
    qc.invalidateQueries({ queryKey: ["customers-bikes"] });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1.5">
          <Bike className="h-3 w-3" /> Bikes ({bikes.data?.length ?? 0})
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {adding && (
        <div className="card-surface p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Make *" value={nb.make} onChange={(e) => setNb({ ...nb, make: e.target.value })} />
            <Input placeholder="Model *" value={nb.model} onChange={(e) => setNb({ ...nb, model: e.target.value })} />
            <Input placeholder="Year" inputMode="numeric" value={nb.year} onChange={(e) => setNb({ ...nb, year: e.target.value.replace(/\D/g, "") })} />
            <Input placeholder="Rego" value={nb.rego} onChange={(e) => setNb({ ...nb, rego: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button onClick={addBike} disabled={busy} className="gold-surface flex-1">{busy ? "Adding…" : "Add bike"}</Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {(bikes.data ?? []).map((b: any) => (
        <Link
          key={b.id}
          to="/motorcycles/$bikeId"
          params={{ bikeId: b.id }}
          className="card-surface p-3 flex items-center gap-3 hover:border-primary/50 transition-colors"
        >
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-primary shrink-0">
            <Bike className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate text-sm">
              {b.make} {b.model}{b.year ? ` · ${b.year}` : ""}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {b.rego ? `Rego ${b.rego}` : "No rego"}
              {b.mileage ? ` · ${b.mileage.toLocaleString()} km` : ""}
              {b.rego_expiry ? ` · Rego exp ${new Date(b.rego_expiry).toLocaleDateString()}` : ""}
              {b.wof_expiry ? ` · WOF exp ${new Date(b.wof_expiry).toLocaleDateString()}` : ""}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
      ))}

      {(bikes.data ?? []).length === 0 && !adding && (
        <div className="card-surface p-6 text-center text-sm text-muted-foreground">No bikes yet.</div>
      )}
    </div>
  );
}
