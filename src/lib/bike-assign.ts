import { supabase } from "@/integrations/supabase/client";

export type BikeLite = {
  id: string;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  rego?: string | null;
  vin?: string | null;
  mileage?: number | null;
};

/** All non-archived motorcycles owned by a customer. */
export async function fetchCustomerBikes(customerId: string | null | undefined) {
  if (!customerId) return [] as BikeLite[];
  const { data } = await supabase
    .from("motorcycles")
    .select("id, year, make, model, rego, vin, mileage")
    .eq("customer_id", customerId)
    .eq("is_archived", false)
    .order("make");
  return (data ?? []) as BikeLite[];
}

/**
 * Assign a motorcycle to a book-in and propagate it everywhere it is mirrored:
 * the booking (bike + rego/vin snapshot), the linked job card, and any
 * unpaid invoice attached to that job. Keeps calendar, day board, job card,
 * printed job card and invoices consistent.
 */
export async function changeBookingMotorcycle(args: {
  bookingId: string;
  motorcycleId: string | null;
  bike?: BikeLite | null;
}): Promise<{ error: string | null }> {
  const { bookingId, motorcycleId } = args;

  let bike = args.bike ?? null;
  if (motorcycleId && !bike) {
    const { data } = await supabase
      .from("motorcycles")
      .select("id, year, make, model, rego, vin, mileage")
      .eq("id", motorcycleId)
      .maybeSingle();
    bike = (data as BikeLite) ?? null;
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .update({
      motorcycle_id: motorcycleId,
      rego: bike?.rego ?? null,
      vin: bike?.vin ?? null,
    })
    .eq("id", bookingId)
    .select("job_id, customer_id")
    .maybeSingle();
  if (error) return { error: error.message };

  if (booking?.job_id && motorcycleId) {
    await supabase
      .from("jobs")
      .update({ motorcycle_id: motorcycleId })
      .eq("id", booking.job_id);
    await supabase
      .from("invoices")
      .update({ motorcycle_id: motorcycleId })
      .eq("job_id", booking.job_id)
      .neq("status", "paid");
  }

  return { error: null };
}
