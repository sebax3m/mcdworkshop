import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type TransportBooking = {
  pickup_required?: boolean | null;
  delivery_required?: boolean | null;
  transport_address?: string | null;
  transport_notes?: string | null;
};

/** Pick-up / drop-off transport options for an existing book-in. */
export function TransportCard({
  bookingId,
  booking,
  onSaved,
}: {
  bookingId: string;
  booking: TransportBooking;
  onSaved?: () => void;
}) {
  const [pickup, setPickup] = useState(!!booking.pickup_required);
  const [delivery, setDelivery] = useState(!!booking.delivery_required);
  const [address, setAddress] = useState(booking.transport_address ?? "");
  const [notes, setNotes] = useState(booking.transport_notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPickup(!!booking.pickup_required);
    setDelivery(!!booking.delivery_required);
    setAddress(booking.transport_address ?? "");
    setNotes(booking.transport_notes ?? "");
  }, [
    booking.pickup_required,
    booking.delivery_required,
    booking.transport_address,
    booking.transport_notes,
  ]);

  const dirty =
    pickup !== !!booking.pickup_required ||
    delivery !== !!booking.delivery_required ||
    address !== (booking.transport_address ?? "") ||
    notes !== (booking.transport_notes ?? "");

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("bookings")
      .update({
        pickup_required: pickup,
        delivery_required: delivery,
        transport_address: pickup || delivery ? address.trim() || null : null,
        transport_notes: pickup || delivery ? notes.trim() || null : null,
      })
      .eq("id", bookingId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Transport updated");
    onSaved?.();
  }

  return (
    <div className="card-surface p-4 space-y-3">
      <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Truck className="h-3 w-3" /> Bike transport
      </div>
      <label className="flex items-center gap-3 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="h-5 w-5 accent-primary"
          checked={pickup}
          onChange={(e) => setPickup(e.target.checked)}
        />
        <span className="font-semibold">Pick up the bike from the customer</span>
      </label>
      <label className="flex items-center gap-3 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="h-5 w-5 accent-primary"
          checked={delivery}
          onChange={(e) => setDelivery(e.target.checked)}
        />
        <span className="font-semibold">Drop the bike back after the work</span>
      </label>
      {(pickup || delivery) && (
        <div className="space-y-2">
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Pick-up / drop-off address"
          />
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Transport notes (contact, access, preferred time…)"
            rows={2}
          />
        </div>
      )}
      <Button size="sm" onClick={save} disabled={!dirty || saving} className="w-full">
        {saving ? "Saving…" : "Save transport"}
      </Button>
    </div>
  );
}
