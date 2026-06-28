import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Clock, Coffee, GripVertical, Wrench } from "lucide-react";

export function FloatingClockWidget() {
  const { user } = useCurrentUser();
  const [now, setNow] = useState(Date.now());
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; initX: number; initY: number } | null>(null);
  const didDragRef = useRef(false);

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

  const activeTimerJob = useQuery({
    queryKey: ["clock-floating-active-time-entry", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("job_id, started_at, jobs(id, job_number, complaint, motorcycles(make, model, rego))")
        .eq("technician_id", user!.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const list = events.data ?? [];
  const last = list[0];
  const activeTimerData = activeTimerJob.data as any;
  const activeTimerStartedAt = activeTimerData?.started_at ? +new Date(activeTimerData.started_at) : 0;
  const lastEventAt = last?.occurred_at ? +new Date(last.occurred_at) : 0;
  const activeTimerIsCurrent = !!activeTimerData && (!last || activeTimerStartedAt > lastEventAt);
  const eventState: "off" | "on" | "break" = !last
    ? "off"
    : last.event_type === "clock_in" || last.event_type === "break_end"
    ? "on"
    : last.event_type === "break_start"
    ? "break"
    : "off";
  const state: "off" | "on" | "break" = eventState === "off" && activeTimerIsCurrent ? "on" : eventState;

  // Find active job_id (latest clock_in in current shift)
  const activeJobId = (() => {
    for (const e of list) {
      if (e.event_type === "clock_out") return null;
      if (e.event_type === "clock_in") return e.job_id as string | null;
    }
    return null;
  })();

  const resolvedJobId = activeJobId ?? (activeTimerIsCurrent ? activeTimerData?.job_id : null) ?? null;

  const job = useQuery({
    queryKey: ["clock-floating-job", resolvedJobId],
    enabled: !!resolvedJobId,
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, job_number, complaint, motorcycles(make, model, rego)")
        .eq("id", resolvedJobId!)
        .maybeSingle();
      return data;
    },
  });

  if (state === "off" || (!last && !activeTimerData)) return null;

  const since = +new Date(last?.occurred_at ?? activeTimerData?.started_at ?? Date.now());
  const sec = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  const isBreak = state === "break";
  const timerMatchesResolvedJob = !!resolvedJobId && activeTimerData?.job_id === resolvedJobId;
  const jobNumber = (job.data as any)?.job_number ?? (timerMatchesResolvedJob ? activeTimerData?.jobs?.job_number : null);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    didDragRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos?.x ?? window.innerWidth - 24 - 220,
      initY: pos?.y ?? 80,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
    let nx = dragRef.current.initX + dx;
    let ny = dragRef.current.initY + dy;
    nx = Math.max(8, Math.min(nx, window.innerWidth - 240));
    ny = Math.max(8, Math.min(ny, window.innerHeight - 120));
    setPos({ x: nx, y: ny });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = null;
  };

  const stylePos = pos
    ? { left: pos.x, top: pos.y, right: "auto" as const }
    : { right: 16, top: 80 };

  return (
    <div
      ref={containerRef}
      className="fixed z-50 print:hidden select-none"
      style={{ pointerEvents: "auto", ...stylePos }}
    >
      <div
        className="relative rounded-2xl border border-white/15 shadow-2xl backdrop-blur-xl min-w-[230px] overflow-hidden"
        style={{
          background: isBreak
            ? "color-mix(in srgb, hsl(var(--status-progress)) 18%, transparent)"
            : "color-mix(in srgb, hsl(var(--primary)) 18%, transparent)",
        }}
      >
        {resolvedJobId ? (
          <Link
            to="/jobs/$jobId"
            params={{ jobId: resolvedJobId }}
            className="block w-full text-left px-4 py-3 pr-10 cursor-pointer hover:bg-foreground/5 transition-colors"
            aria-label={`Open Job Card ${jobNumber ? `#${jobNumber}` : ""}`}
          >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-foreground/80">
              {isBreak ? <Coffee className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {isBreak ? "On break" : "Clocked in"}
            </div>
            <div className="font-display text-2xl font-bold tabular-nums leading-tight mt-0.5 text-foreground">
              {time}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-sm font-bold text-primary">
              <Wrench className="h-3.5 w-3.5" />
              <span className="truncate">Open Job Card {jobNumber ? `#${jobNumber}` : "#…"}</span>
            </div>
          </Link>
        ) : (
          <Link
            to="/clock"
            className="block w-full text-left px-4 py-3 pr-10 cursor-pointer hover:bg-foreground/5 transition-colors"
            aria-label="Open clock"
          >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-foreground/80">
              {isBreak ? <Coffee className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {isBreak ? "On break" : "Clocked in"}
            </div>
            <div className="font-display text-2xl font-bold tabular-nums leading-tight mt-0.5 text-foreground">
              {time}
            </div>
            <div className="mt-1 text-xs text-foreground/70">Select a job card</div>
          </Link>
        )}
        <button
          type="button"
          aria-label="Move floating clock"
          className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-lg text-foreground/55 cursor-grab active:cursor-grabbing hover:bg-foreground/10"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
