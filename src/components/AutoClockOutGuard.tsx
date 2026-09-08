import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

const CLOCK_OUT_HOUR = 17; // 5:30 PM local time
const CLOCK_OUT_MINUTE = 30;

/** Cut-off (5:30 PM) of the day the clock-in happened, in local time. */
function cutoffFor(clockInAt: Date) {
  const d = new Date(clockInAt);
  d.setHours(CLOCK_OUT_HOUR, CLOCK_OUT_MINUTE, 0, 0);
  return d;
}

export function AutoClockOutGuard() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [warning, setWarning] = useState<string | null>(null);
  const processingRef = useRef(false);

  const lastEvent = useQuery({
    queryKey: ["auto-clockout-last-event", user?.id],
    enabled: !!user,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data } = await supabase
        .from("clock_events")
        .select("id, event_type, occurred_at")
        .eq("user_id", user!.id)
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const ev = lastEvent.data;
    if (!user || !ev || processingRef.current) return;
    if (ev.event_type !== "clock_in" && ev.event_type !== "break_end" && ev.event_type !== "break_start") return;

    const clockInAt = new Date(ev.occurred_at);
    const cutoff = cutoffFor(clockInAt);
    // Shifts that start at/after 5:30 PM are intentional late work — never auto-close them.
    if (cutoff.getTime() <= clockInAt.getTime()) return;
    if (Date.now() <= cutoff.getTime()) return; // still before 5:30 PM of that day


    processingRef.current = true;
    (async () => {
      const { error } = await supabase.from("clock_events").insert({
        user_id: user.id,
        event_type: "clock_out",
        occurred_at: cutoff.toISOString(),
        note: "auto_closed",
      } as never);
      if (!error) {
        const dateStr = clockInAt.toLocaleDateString("en-GB");
        setWarning(
          `Your clock-in from ${dateStr} was left active. You were automatically clocked out at 5:30 PM. Please let the office know if your hours need adjusting.`,
        );
        await qc.invalidateQueries({ queryKey: ["clock-events-floating"] });
        await qc.invalidateQueries({ queryKey: ["auto-clockout-last-event"] });
        await qc.invalidateQueries({ queryKey: ["clock-events"] });
      }
      processingRef.current = false;
    })();
  }, [lastEvent.data, user, qc]);

  return (
    <AlertDialog open={!!warning} onOpenChange={(o) => !o && setWarning(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Automatic clock-out
          </AlertDialogTitle>
          <AlertDialogDescription>{warning}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setWarning(null)}>Got it</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
