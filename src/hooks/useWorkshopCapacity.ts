/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CapacityRow = { weekday: number; max_bookins: number };

const DEFAULTS: Record<number, number> = { 0: 0, 1: 8, 2: 8, 3: 8, 4: 8, 5: 6, 6: 3 };

export function useWorkshopCapacity() {
  const q = useQuery({
    queryKey: ["workshop-capacity"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<CapacityRow[]> => {
      const { data, error } = await (supabase as any)
        .from("workshop_capacity")
        .select("weekday, max_bookins");
      if (error) throw error;
      return (data ?? []) as CapacityRow[];
    },
  });

  const map = new Map<number, number>();
  for (const r of q.data ?? []) map.set(Number(r.weekday), Number(r.max_bookins));

  /** Max book-ins allowed for a given date (JS weekday 0=Sunday). */
  const capacityFor = (d: Date) => map.get(d.getDay()) ?? DEFAULTS[d.getDay()] ?? 8;

  return { ...q, capacityFor, byWeekday: map };
}

export function useSaveWorkshopCapacity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: CapacityRow[]) => {
      const { error } = await (supabase as any)
        .from("workshop_capacity")
        .upsert(
          rows.map((r) => ({
            weekday: r.weekday,
            max_bookins: r.max_bookins,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "weekday" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workshop-capacity"] }),
  });
}
