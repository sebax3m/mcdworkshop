import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useBookingTypes, type BookingType } from "@/hooks/useBookingTypes";

export const Route = createFileRoute("/_authenticated/settings/booking-types")({
  component: BookingTypesAdmin,
});

function BookingTypesAdmin() {
  const qc = useQueryClient();
  const { data: types = [], isLoading } = useBookingTypes(false);
  const [newName, setNewName] = useState("");
  const [newOrder, setNewOrder] = useState<string>("100");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["booking-types"] });

  const createMut = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error("Name is required");
      const { error } = await supabase.from("booking_types" as never).insert({
        name,
        sort_order: Number(newOrder) || 100,
        is_active: true,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName("");
      setNewOrder("100");
      invalidate();
      toast.success("Booking type added");
    },
    onError: (e: unknown) => toast.error((e as Error).message ?? "Failed"),
  });

  const toggleMut = useMutation({
    mutationFn: async (t: BookingType) => {
      const { error } = await supabase
        .from("booking_types" as never)
        .update({ is_active: !t.is_active } as never)
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: unknown) => toast.error((e as Error).message ?? "Failed"),
  });

  const renameMut = useMutation({
    mutationFn: async (input: { id: string; name: string; sort_order: number }) => {
      const { error } = await supabase
        .from("booking_types" as never)
        .update({ name: input.name, sort_order: input.sort_order } as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: unknown) => toast.error((e as Error).message ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("booking_types" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Booking type deleted");
    },
    onError: (e: unknown) =>
      toast.error(
        (e as Error).message ??
          "Could not delete — deactivate it instead if it's used by past bookings.",
      ),
  });

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <header className="flex items-center gap-3">
        <Link
          to="/settings"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:border-primary/50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Admin</div>
          <h1 className="font-display text-2xl font-bold">Booking Types</h1>
        </div>
      </header>

      <p className="text-sm text-muted-foreground">
        Only active types appear in new booking forms. Deactivating a type keeps existing bookings
        intact — historical service types are preserved on the booking record.
      </p>

      <section className="card-surface p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Add new type</div>
        <div className="grid grid-cols-[minmax(0,1fr)_100px_auto] gap-2">
          <Input
            placeholder="e.g. Winter Prep"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Order"
            value={newOrder}
            onChange={(e) => setNewOrder(e.target.value)}
          />
          <Button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !newName.trim()}
            className="gap-1"
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </section>

      <section className="card-surface divide-y divide-border">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : types.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No booking types yet.</div>
        ) : (
          types.map((t) => (
            <BookingTypeRow
              key={t.id}
              type={t}
              onToggle={() => toggleMut.mutate(t)}
              onSave={(name, sort_order) => renameMut.mutate({ id: t.id, name, sort_order })}
              onDelete={() => {
                if (
                  window.confirm(
                    `Delete "${t.name}"? This may fail if the type is used by existing bookings — deactivate it instead in that case.`,
                  )
                ) {
                  deleteMut.mutate(t.id);
                }
              }}
            />
          ))
        )}
      </section>
    </div>
  );
}

function BookingTypeRow({
  type,
  onToggle,
  onSave,
  onDelete,
}: {
  type: BookingType;
  onToggle: () => void;
  onSave: (name: string, sort_order: number) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(type.name);
  const [order, setOrder] = useState(String(type.sort_order));
  const dirty = name !== type.name || Number(order) !== type.sort_order;

  return (
    <div className="p-3 grid grid-cols-[minmax(0,1fr)_90px_auto_auto_auto] gap-2 items-center">
      <Input value={name} onChange={(e) => setName(e.target.value)} />
      <Input type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
      <Button
        variant="outline"
        size="sm"
        disabled={!dirty || !name.trim()}
        onClick={() => onSave(name.trim(), Number(order) || 100)}
      >
        Save
      </Button>
      <button
        onClick={onToggle}
        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
          type.is_active
            ? "border-green-500/40 bg-green-500/10 text-green-500"
            : "border-border bg-muted text-muted-foreground"
        }`}
      >
        {type.is_active ? "Active" : "Inactive"}
      </button>
      <button
        onClick={onDelete}
        className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50"
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
