import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Clock, Coffee, GripVertical, Wrench } from "lucide-react";

export function FloatingClockWidget() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
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

  // Fallback: active timer from time_entries (in case clock_events hasn't synced yet)
  const activeTimerJob = useQuery({
    queryKey: ["clock-floating-timer-job", user?.id],
    enabled: !!user && state !== "off",
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("job_id")
        .eq("technician_id", user!.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.job_id as string | null;
    },
  });

  const resolvedJobId = activeJobId ?? activeTimerJob.data ?? null;

  const job = useQuery({
    queryKey: ["clock-floating-job", resolvedJobId],
    enabled: !!resolvedJobId,
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, job_number, complaint, bikes(make, model)")
        .eq("id", resolvedJobId!)
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

  const handlePointerDown = (e: React.PointerEvent) => {
    didDragRef.current = false;
    containerRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: pos?.x ?? window.innerWidth - 24 - 220,
      initY: pos?.y ?? 80,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDragRef.current = true;
    let nx = dragRef.current.initX + dx;
    let ny = dragRef.current.initY + dy;
    nx = Math.max(8, Math.min(nx, window.innerWidth - 240));
    ny = Math.max(8, Math.min(ny, window.innerHeight - 120));
    setPos({ x: nx, y: ny });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleClick = () => {
    if (didDragRef.current) return;
    if (resolvedJobId) {
      navigate({ to: "/jobs/$jobId", params: { jobId: resolvedJobId } });
    } else {
      navigate({ to: "/clock" });
    }
  };

  const stylePos = pos
    ? { left: pos.x, top: pos.y, right: "auto" as const }
    : { right: 16, top: 80 };

  return (
    <div
      ref={containerRef}
      className="fixed z-50 print:hidden select-none"
      style={{ pointerEvents: "auto", ...stylePos }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <button
        onClick={handleClick}
        className="text-left rounded-2xl border border-white/15 shadow-2xl backdrop-blur-xl px-4 py-3 min-w-[220px] cursor-grab active:cursor-grabbing"
        style={{
          background: isBreak
            ? "color-mix(in srgb, hsl(var(--status-progress)) 18%, transparent)"
            : "color-mix(in srgb, hsl(var(--primary)) 18%, transparent)",
        }}
      >
        <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest text-foreground/80">
          <div className="flex items-center gap-2">
            {isBreak ? <Coffee className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {isBreak ? "On break" : "Clocked in"}
          </div>
          <GripVertical className="h-3.5 w-3.5 opacity-50" />
        </div>
        <div className="font-display text-2xl font-bold tabular-nums leading-tight mt-0.5 text-foreground">
          {time}
        </div>
        {resolvedJobId && job.data ? (
          <div className="mt-2 flex items-center gap-1.5 text-sm font-bold text-primary">
            <Wrench className="h-3.5 w-3.5" />
            <span className="truncate">Open Job Card #{(job.data as any).job_number}</span>
          </div>
        ) : (
          <div className="mt-1 text-xs text-foreground/70">Open clock →</div>
        )}
      </button>
    </div>
  );
}
