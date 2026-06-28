import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Clock, Coffee, ExternalLink } from "lucide-react";

export function FloatingClockWidget() {
  const { user } = useCurrentUser();
  const [now, setNow] = useState(Date.now());

  const events = useQuery({
    queryKey: ["clock-events-floating", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("clock_events")
        .select("id, event_type, occurred_at, job_id")
        .eq("user_id", user!.id)
        .order("occurred_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const list = events.data ?? [];
  const last = list[0];
  const state: "off" | "on" | "break" = !last
    ? "off"
    : last.event_type === "clock_in" || last.event_type === "break_end"
    ? "on"
    : last.event_type === "break_start"
    ? "break"
    : "off";

  // Find active job_id (latest clock_in in current shift)
  const activeJobId = (() => {
    for (const e of list) {
      if (e.event_type === "clock_out") return null;
      if (e.event_type === "clock_in") return e.job_id as string | null;
    }
    return null;
  })();

  const job = useQuery({
    queryKey: ["clock-floating-job", activeJobId],
    enabled: !!activeJobId,
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, job_number, complaint, bikes(make, model)")
        .eq("id", activeJobId!)
        .maybeSingle();
      return data;
    },
  });

  if (state === "off" || !last) return null;

  const since = +new Date(last.occurred_at);
  const sec = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  const isBreak = state === "break";
  const bike = (job.data as any)?.bikes;
  const bikeStr = bike ? `${bike.make ?? ""} ${bike.model ?? ""}`.trim() : "";

  return (
    <div
      className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-50 print:hidden"
      style={{ pointerEvents: "auto" }}
    >
      <div
        className="rounded-2xl border border-white/15 shadow-2xl backdrop-blur-xl px-4 py-3 min-w-[220px]"
        style={{
          background: isBreak
            ? "color-mix(in srgb, hsl(var(--status-progress)) 18%, transparent)"
            : "color-mix(in srgb, hsl(var(--primary)) 18%, transparent)",
        }}
      >
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-foreground/80">
          {isBreak ? <Coffee className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          {isBreak ? "On break" : "Clocked in"}
        </div>
        <div className="font-display text-2xl font-bold tabular-nums leading-tight mt-0.5 text-foreground">
          {time}
        </div>
        {activeJobId && job.data ? (
          <Link
            to="/jobs/$jobId"
            params={{ jobId: activeJobId }}
            className="mt-1 flex items-center justify-between gap-2 text-xs text-foreground/90 hover:text-primary group"
          >
            <span className="truncate">
              <span className="font-semibold">#{(job.data as any).job_number}</span>
              {bikeStr && <span className="text-foreground/70"> · {bikeStr}</span>}
            </span>
            <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 shrink-0" />
          </Link>
        ) : (
          <Link to="/clock" className="mt-1 block text-xs text-foreground/70 hover:text-primary">
            Open clock →
          </Link>
        )}
      </div>
    </div>
  );
}
