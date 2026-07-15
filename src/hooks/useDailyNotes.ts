import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DailyNote = {
  id: string;
  note_date: string;
  title: string;
  body: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useDailyNotesRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["daily-notes", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes" as never)
        .select("id, note_date, title, body, created_by, created_at, updated_at")
        .gte("note_date", startDate)
        .lte("note_date", endDate)
        .order("note_date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DailyNote[];
    },
  });
}

export function useDailyNotesForDate(date: string) {
  return useQuery({
    queryKey: ["daily-notes-day", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes" as never)
        .select("id, note_date, title, body, created_by, created_at, updated_at")
        .eq("note_date", date)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as DailyNote[];
    },
    enabled: !!date,
  });
}

export function useCreateDailyNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { note_date: string; title: string; body?: string | null }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("daily_notes" as never)
        .insert({
          note_date: input.note_date,
          title: input.title,
          body: input.body ?? null,
          created_by: user.id,
        } as never)
        .select("id, note_date, title, body, created_by, created_at, updated_at")
        .single();
      if (error) throw error;
      return data as unknown as DailyNote;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-notes"] });
      qc.invalidateQueries({ queryKey: ["daily-notes-day"] });
    },
  });
}

export function useUpdateDailyNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title?: string; body?: string | null }) => {
      const patch: Record<string, unknown> = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.body !== undefined) patch.body = input.body;
      const { error } = await supabase
        .from("daily_notes" as never)
        .update(patch as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-notes"] });
      qc.invalidateQueries({ queryKey: ["daily-notes-day"] });
    },
  });
}

export function useDeleteDailyNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("daily_notes" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-notes"] });
      qc.invalidateQueries({ queryKey: ["daily-notes-day"] });
    },
  });
}
