import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BookingType = {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  color: string | null;
};

/**
 * Returns booking types the workshop currently uses.
 * - `activeOnly: true` (default) → only active types (for new/edit forms).
 * - `activeOnly: false` → all types (for admin management panel).
 *
 * Old bookings referencing an inactive type keep displaying their stored
 * service_type string because rendering does not depend on this list.
 */
export function useBookingTypes(activeOnly = true) {
  return useQuery({
    queryKey: ["booking-types", activeOnly],
    queryFn: async () => {
      let q = supabase
        .from("booking_types" as never)
        .select("id, name, is_active, sort_order, color")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as BookingType[];
    },
    staleTime: 60_000,
  });
}

/**
 * Names of currently active booking types. Falls back to an empty list
 * while loading — callers should render a skeleton or the stored value.
 */
export function useActiveBookingTypeNames(): string[] {
  const { data } = useBookingTypes(true);
  return (data ?? []).map((t) => t.name);
}
