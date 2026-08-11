/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Clock, Coffee, LogIn, LogOut, Play } from "lucide-react";

type State = "off" | "on" | "break";

export function ShiftClockCard({ userId, jobId }: { userId: string; jobId: string }) {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const events = useQuery({
    queryKey: ["clock-events-job", userId],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("clock_events")
        .select("id, event_type, occurred_at, job_id")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const last = (events.data ?? [])[0] as any;
  const state: State = !last
    ? "off"
    : last.event_type === "clock_in" || last.event_type === "break_end"
      ? "on"
      : last.event_type === "break_start"
        ? "break"
        : "off";

  const since = last?.occurred_at ? +new Date(last.occurred_at) : 0;
  const sec = since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
  const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");

  async function log(event_type: "clock_in" | "clock_out" | "break_start" | "break_end") {
    setBusy(true);
    const { error } = await supabase
      .from("clock_events")
      .insert({ user_id: userId, event_type, job_id: jobId });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    // Clocking in on a job takes it over: the job is reassigned to whoever is working on it now.
    if (event_type === "clock_in") {
      const { data: current } = await supabase
        .from("jobs")
        .select("technician_id, assigned_tech_id, status")
        .eq("id", jobId)
        .maybeSingle();
      if (current && (current.technician_id !== userId || current.assigned_tech_id !== userId)) {
        const patch = {
          technician_id: userId,
          assigned_tech_id: userId,
          ...(current.status === "new" ? { status: "assigned" as const } : {}),
        };
        const { error: assignError } = await supabase.from("jobs").update(patch).eq("id", jobId);
        if (!assignError) {
          toast.success("Job reassigned to you");
          qc.invalidateQueries({ queryKey: ["job", jobId] });
          qc.invalidateQueries({ queryKey: ["jobs"] });
        }
      }
    }
    setBusy(false);
    toast.success(
      event_type === "clock_in"
        ? "Clocked in"
        : event_type === "clock_out"
          ? "Clocked out"
          : event_type === "break_start"
            ? "Break started"
            : "Back from break",
    );
    qc.invalidateQueries({ queryKey: ["clock-events-job", userId] });
    qc.invalidateQueries({ queryKey: ["clock-events-floating", userId] });
    qc.invalidateQueries({ queryKey: ["clock-events"] });
    qc.invalidateQueries({ queryKey: ["clock-floating-job"] });
  }


  return (
    <div className="card-surface p-4 print:hidden">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            My shift clock
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {state === "break" ? (
              <Coffee className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-display text-2xl font-bold tabular-nums">
              {state === "off" ? "Off shift" : `${hh}:${mm}:${ss}`}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {state === "on"
              ? "On shift — clocked in from this job card"
              : state === "break"
                ? "On break"
                : "Clock in to start your shift"}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {state === "off" && (
            <Button onClick={() => log("clock_in")} disabled={busy} className="h-11 px-4 gap-2">
              <LogIn className="h-4 w-4" /> Clock in
            </Button>
          )}
          {state === "on" && (
            <>
              <Button
                variant="outline"
                onClick={() => log("break_start")}
                disabled={busy}
                className="h-11 px-4 gap-2"
              >
                <Coffee className="h-4 w-4" /> Break
              </Button>
              <Button
                variant="outline"
                onClick={() => log("clock_out")}
                disabled={busy}
                className="h-11 px-4 gap-2 text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4" /> Clock out
              </Button>
            </>
          )}
          {state === "break" && (
            <Button onClick={() => log("break_end")} disabled={busy} className="h-11 px-4 gap-2">
              <Play className="h-4 w-4" /> Resume
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
