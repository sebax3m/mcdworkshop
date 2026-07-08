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
