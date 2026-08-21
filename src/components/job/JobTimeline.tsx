import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTechnicianNames } from "@/hooks/use-technician-names";
import { History } from "lucide-react";

export function JobTimeline({ jobId }: { jobId: string }) {
  const names = useTechnicianNames();
  const { data: events = [] } = useQuery({
    queryKey: ["job-events", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_events")
        .select("id, event_type, summary, detail, created_by, created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (events.length === 0) return null;

  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-primary" />
        <h2 className="font-display text-base font-bold uppercase tracking-wider">Approval history</h2>
      </div>
      <ol className="space-y-2.5">
        {events.map((e) => (
          <li key={e.id} className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0">
              <div className="text-sm">{e.summary}</div>
              <div className="text-[0.6875rem] text-muted-foreground">
                {format(new Date(e.created_at), "d MMM yyyy · HH:mm")}
                {e.created_by ? ` · ${names.get(e.created_by) ?? "Staff"}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
