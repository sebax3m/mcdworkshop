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
  // Ticks so the check below re-runs even when the last event hasn't changed
  // (react-query keeps the same object reference when the data is identical).
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const lastEvent = useQuery({
    queryKey: ["auto-clockout-last-event", user?.id],
    enabled: !!user,
    refetchInterval: 60000,
    refetchOnWindowFocus: true,
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
    void tick;
    if (!user || processingRef.current) return;
    const ev = lastEvent.data;

    const shiftOpen =
      !!ev &&
      (ev.event_type === "clock_in" ||
        ev.event_type === "break_end" ||
        ev.event_type === "break_start");

    let eventCutoff: Date | null = null;
    if (shiftOpen && ev) {
      const clockInAt = new Date(ev.occurred_at);
      const c = cutoffFor(clockInAt);
      // Shifts that start at/after 5:30 PM are intentional late work — never auto-close them.
      if (c.getTime() > clockInAt.getTime() && Date.now() > c.getTime()) eventCutoff = c;
    }

    processingRef.current = true;
    (async () => {
      let didSomething = false;

      // 1) Close any job timer left running past its own 5:30 PM cut-off.
      const { data: openEntries } = await supabase
        .from("time_entries")
        .select("id, started_at")
        .eq("technician_id", user.id)
        .is("ended_at", null);
      for (const entry of openEntries ?? []) {
        const startedAt = new Date(entry.started_at);
        const c = cutoffFor(startedAt);
        if (c.getTime() <= startedAt.getTime() || Date.now() <= c.getTime()) continue;
        const minutes = Math.max(1, Math.round((+c - +startedAt) / 60000));
        const { error } = await supabase
          .from("time_entries")
          .update({ ended_at: c.toISOString(), minutes })
          .eq("id", entry.id);
        if (error) console.error("Auto close time entry failed", error);
        else didSomething = true;
      }

      // 2) Close the shift itself.
      if (eventCutoff) {
        const { error } = await supabase.from("clock_events").insert({
          user_id: user.id,
          event_type: "clock_out",
          occurred_at: eventCutoff.toISOString(),
          note: "auto_closed",
        } as never);
        if (error) {
          console.error("Auto clock-out failed", error);
        } else {
          didSomething = true;
          const dateStr = eventCutoff.toLocaleDateString("en-GB");
          setWarning(
            `Your clock-in from ${dateStr} was left active. You were automatically clocked out at 5:30 PM. Please let the office know if your hours need adjusting.`,
          );
        }
      }

      if (didSomething) {
        await qc.invalidateQueries({ queryKey: ["clock-events-floating"] });
        await qc.invalidateQueries({ queryKey: ["auto-clockout-last-event"] });
        await qc.invalidateQueries({ queryKey: ["clock-events"] });
        await qc.invalidateQueries({ queryKey: ["clock-floating-active-time-entry"] });
        await qc.invalidateQueries({ queryKey: ["time-entries"] });
        await lastEvent.refetch();
      }
      processingRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastEvent.data, user, qc, tick]);


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
