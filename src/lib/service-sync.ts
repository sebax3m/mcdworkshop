import { supabase } from "@/integrations/supabase/client";
import { serviceColor } from "@/lib/service-colors";
import { displayServiceType } from "@/lib/display";

/**
 * Change a book-in's service type and propagate it everywhere it is mirrored:
 * the booking row (type + colour) and the linked job card (title + colour).
 * Keeps the calendar, day board, job card and printed job card consistent.
 */
export async function changeBookingServiceType(args: {
  bookingId: string;
  serviceType: string;
  serviceTypeOther?: string | null;
}): Promise<{ error: string | null; color: string }> {
  const { bookingId, serviceType } = args;
  const isOther = serviceType.toLowerCase() === "other";
  const other = isOther ? (args.serviceTypeOther?.trim() || null) : null;
  const color = serviceColor(serviceType).hex;

  const { data, error } = await supabase
    .from("bookings")
    .update({ service_type: serviceType, service_type_other: other, color })
    .eq("id", bookingId)
    .select("job_id")
    .maybeSingle();

  if (error) return { error: error.message, color };

  if (data?.job_id) {
    await supabase
      .from("jobs")
      .update({ title: displayServiceType(serviceType, other), color })
      .eq("id", data.job_id);
  }

  return { error: null, color };
}

/** Update only the free-text "Other" detail and re-sync the linked job title. */
export async function changeBookingServiceOther(args: {
  bookingId: string;
  serviceType: string | null | undefined;
  serviceTypeOther: string | null;
}): Promise<{ error: string | null }> {
  const { bookingId, serviceType, serviceTypeOther } = args;
  const { data, error } = await supabase
    .from("bookings")
    .update({ service_type_other: serviceTypeOther })
    .eq("id", bookingId)
    .select("job_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (data?.job_id) {
    await supabase
      .from("jobs")
      .update({ title: displayServiceType(serviceType, serviceTypeOther) })
      .eq("id", data.job_id);
  }
  return { error: null };
}
