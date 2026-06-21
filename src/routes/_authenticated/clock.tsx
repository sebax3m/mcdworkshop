import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { Coffee, LogIn, LogOut, Play } from "lucide-react";
import { formatMinutes } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/clock")({
  component: ClockPage,
});

type EventType = "clock_in" | "clock_out" | "break_start" | "break_end";

function ClockPage() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();

  const events = useQuery({
    queryKey: ["clock-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 7); since.setHours(0,0,0,0);
      const { data } = await supabase.from("clock_events").select("*").eq("user_id", user!.id).gte("occurred_at", since.toISOString()).order("occurred_at", { ascending: false });
      return data ?? [];
    },
  });

  const last = events.data?.[0];
  const state: "off" | "on" | "break" = useMemo(() => {
    if (!last) return "off";
    if (last.event_type === "clock_in" || last.event_type === "break_end") return "on";
    if (last.event_type === "break_start") return "break";
    return "off";
  }, [last]);

  // Week totals
  const week = useMemo(() => {
    const list = [...(events.data ?? [])].reverse();
    let total = 0, breakMin = 0;
    let onSince: Date | null = null, breakSince: Date | null = null;
    for (const e of list) {
      const d = new Date(e.occurred_at);
      if (e.event_type === "clock_in") onSince = d;
      if (e.event_type === "clock_out" && onSince) {
        total += (+d - +onSince) / 60000; onSince = null;
      }
      if (e.event_type === "break_start") breakSince = d;
      if (e.event_type === "break_end" && breakSince) {
        breakMin += (+d - +breakSince) / 60000; breakSince = null;
      }
    }
    return { workMin: Math.round(total - breakMin), breakMin: Math.round(breakMin) };
  }, [events.data]);

  async function add(type: EventType) {
    if (!user) return;
    const { error } = await supabase.from("clock_events").insert({ user_id: user.id, event_type: type });
    if (error) return toast.error(error.message);
    toast.success(type.replace("_", " "));
    qc.invalidateQueries({ queryKey: ["clock-events", user.id] });
    qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <header>
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Time Clock</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Your shift</h1>
      </header>

      <ClockHero state={state} since={last?.occurred_at} />

      <div className="grid grid-cols-2 gap-3">
        {state === "off" && (
          <Button onClick={() => add("clock_in")} className="col-span-2 h-20 text-lg gold-surface font-bold gap-2">
            <LogIn className="h-5 w-5" /> Clock In
          </Button>
        )}
        {state === "on" && (
          <>
            <Button onClick={() => add("break_start")} className="h-20 text-base font-bold gap-2 bg-secondary text-foreground hover:bg-secondary/80">
              <Coffee className="h-5 w-5" /> Start Break
            </Button>
            <Button onClick={() => add("clock_out")} className="h-20 text-base font-bold gap-2 bg-status-parts hover:bg-status-parts/90 text-white">
              <LogOut className="h-5 w-5" /> Clock Out
            </Button>
          </>
        )}
        {state === "break" && (
          <>
            <Button onClick={() => add("break_end")} className="h-20 text-base font-bold gap-2 gold-surface">
              <Play className="h-5 w-5" /> Resume
            </Button>
            <Button onClick={() => add("clock_out")} className="h-20 text-base font-bold gap-2 bg-status-parts hover:bg-status-parts/90 text-white">
              <LogOut className="h-5 w-5" /> Clock Out
            </Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">This week — worked</div>
          <div className="font-display text-3xl font-bold gold-gradient-text mt-1">{formatMinutes(week.workMin)}</div>
        </div>
        <div className="card-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">This week — breaks</div>
          <div className="font-display text-3xl font-bold text-foreground mt-1">{formatMinutes(week.breakMin)}</div>
        </div>
      </div>

      <section className="card-surface p-4">
        <h2 className="font-display text-lg font-semibold mb-3">Recent activity</h2>
        <div className="space-y-1.5">
          {(events.data ?? []).slice(0, 10).map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm border-b border-border/40 last:border-0 py-1.5">
              <span className="capitalize font-medium">{e.event_type.replace("_", " ")}</span>
              <span className="text-muted-foreground text-xs">{new Date(e.occurred_at).toLocaleString()}</span>
            </div>
          ))}
          {(!events.data || events.data.length === 0) && <p className="text-sm text-muted-foreground">No clock activity yet.</p>}
        </div>
      </section>
    </div>
  );
}

function ClockHero({ state, since }: { state: "off" | "on" | "break"; since?: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const sec = since ? Math.max(0, Math.floor((now - +new Date(since)) / 1000)) : 0;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const palette = state === "on" ? "border-status-ready/40 bg-status-ready/5" : state === "break" ? "border-status-progress/40 bg-status-progress/5" : "border-border";
  const label = state === "on" ? "Clocked in" : state === "break" ? "On break" : "Clocked out";
  return (
    <div className={`rounded-2xl border ${palette} p-6 text-center`}>
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{label}</div>
      {state !== "off" ? (
        <div className="font-display text-5xl font-bold tabular-nums mt-2">
          {String(h).padStart(2,"0")}<span className="text-muted-foreground">:</span>{String(m).padStart(2,"0")}<span className="text-muted-foreground">:</span>{String(s).padStart(2,"0")}
        </div>
      ) : (
        <div className="font-display text-5xl font-bold mt-2 text-muted-foreground">—:—:—</div>
      )}
      <div className="text-xs text-muted-foreground mt-1">
        {since ? `Since ${new Date(since).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Tap clock in to start your shift"}
      </div>
    </div>
  );
}