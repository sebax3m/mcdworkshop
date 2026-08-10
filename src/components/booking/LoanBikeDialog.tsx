/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { displayCustomerName } from "@/lib/display";

type Props = {
  bookingId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  presetBikeId?: string | null;
  onSaved?: () => void;
};

/**
 * Assign / edit / return the loan bike attached to an existing booking.
 */
export function LoanBikeDialog({ bookingId, open, onOpenChange, presetBikeId, onSaved }: Props) {
  const [bikeId, setBikeId] = useState<string | null>(null);
  const [expectedReturn, setExpectedReturn] = useState("");
  const [startKm, setStartKm] = useState("");
  const [endKm, setEndKm] = useState("");
  const [saving, setSaving] = useState(false);

  const bookingQ = useQuery({
    queryKey: ["loan-bike-dialog-booking", bookingId],
    enabled: open && !!bookingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_date, loan_bike, loan_bike_id, loan_bike_expected_return, loan_bike_start_km, loan_bike_end_km, loan_bike_returned_at, customers(first_name,last_name)",
        )
        .eq("id", bookingId!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const bikesQ = useQuery({
    queryKey: ["loan-bike-dialog-bikes"],
    enabled: open,
    queryFn: async () => {
      const [{ data: bikes }, { data: busy }] = await Promise.all([
        supabase.from("loan_bikes").select("*").eq("active", true).order("name"),
        supabase
          .from("bookings")
          .select("id, loan_bike_id, loan_bike_expected_return, customers(first_name,last_name)")
          .not("loan_bike_id", "is", null)
          .is("loan_bike_returned_at", null),
      ]);
      return { bikes: (bikes ?? []) as any[], busy: (busy ?? []) as any[] };
    },
  });

  const b = bookingQ.data;

  useEffect(() => {
    if (!open) return;
    if (b) {
      setBikeId(b.loan_bike_id ?? presetBikeId ?? null);
      setExpectedReturn(b.loan_bike_expected_return ?? "");
      setStartKm(b.loan_bike_start_km != null ? String(b.loan_bike_start_km) : "");
      setEndKm(b.loan_bike_end_km != null ? String(b.loan_bike_end_km) : "");
    }
  }, [open, b, presetBikeId]);

  const isOut = !!b?.loan_bike_id && !b?.loan_bike_returned_at;

  async function save() {
    if (!bookingId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          loan_bike: !!bikeId,
          loan_bike_id: bikeId,
          loan_bike_expected_return: bikeId && expectedReturn ? expectedReturn : null,
          loan_bike_start_km: bikeId && startKm ? parseInt(startKm, 10) : null,
          loan_bike_end_km: bikeId && endKm ? parseInt(endKm, 10) : null,
        })
        .eq("id", bookingId);
      if (error) throw error;
      toast.success(bikeId ? "Loan bike saved" : "Loan bike removed");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save loan bike");
    } finally {
      setSaving(false);
    }
  }

  async function markReturned() {
    if (!bookingId || !bikeId) return;
    setSaving(true);
    try {
      const km = endKm ? parseInt(endKm, 10) : null;
      const { error } = await supabase
        .from("bookings")
        .update({
          loan_bike_returned_at: new Date().toISOString(),
          loan_bike_end_km: km,
          loan_bike_expected_return: expectedReturn || null,
        })
        .eq("id", bookingId);
      if (error) throw error;
      if (km != null) {
        await supabase.from("loan_bikes").update({ current_km: km }).eq("id", bikeId);
      }
      toast.success("Loan bike marked returned");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Loan bike</DialogTitle>
        </DialogHeader>

        {bookingQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Booking for {displayCustomerName(b?.customers, "customer")}
              {b?.scheduled_date ? ` · ${b.scheduled_date}` : ""}
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {(bikesQ.data?.bikes ?? []).map((lb: any) => {
                const outWith = (bikesQ.data?.busy ?? []).find(
                  (a: any) => a.loan_bike_id === lb.id && a.id !== bookingId,
                );
                const selected = bikeId === lb.id;
                return (
                  <button
                    key={lb.id}
                    type="button"
                    onClick={() => setBikeId(selected ? null : lb.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold truncate">
                        {lb.name}
                        {lb.rego ? ` · ${lb.rego}` : ""}
                      </span>
                      {outWith ? (
                        <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[0.625rem] font-bold uppercase">
                          Out
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/15 text-emerald-500 px-2 py-0.5 text-[0.625rem] font-bold uppercase">
                          Available
                        </span>
                      )}
                    </div>
                    {outWith && (
                      <div className="text-[0.7rem] text-muted-foreground">
                        With {displayCustomerName(outWith.customers, "customer")}
                        {outWith.loan_bike_expected_return &&
                          ` · back ${outWith.loan_bike_expected_return}`}
                      </div>
                    )}
                  </button>
                );
              })}
              {(bikesQ.data?.bikes ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No loan bikes in the fleet yet.</p>
              )}
            </div>

            {bikeId && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Expected return</Label>
                  <Input
                    type="date"
                    value={expectedReturn}
                    onChange={(e) => setExpectedReturn(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Start km</Label>
                  <Input
                    inputMode="numeric"
                    value={startKm}
                    onChange={(e) => setStartKm(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
                <div>
                  <Label>End km</Label>
                  <Input
                    inputMode="numeric"
                    value={endKm}
                    onChange={(e) => setEndKm(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {isOut ? (
            <Button variant="outline" onClick={markReturned} disabled={saving}>
              Mark returned
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !bookingId}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
