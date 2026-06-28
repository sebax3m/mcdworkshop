import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { Coffee, LogIn, LogOut, Play, Wrench } from "lucide-react";
import { formatMinutes } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/clock")({
  component: ClockPage,
});

type EventType = "clock_in" | "clock_out" | "break_start" | "break_end";

function ClockPage() {
  const { user, fullName } = useCurrentUser();
  const qc = useQueryClient();
  const [pickingJob, setPickingJob] = useState(false);
  const [jobQuery, setJobQuery] = useState("");

  const events = useQuery({
    queryKey: ["clock-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 7); since.setHours(0,0,0,0);
      const { data } = await supabase.from("clock_events").select("*, jobs(job_number)").eq("user_id", user!.id).gte("occurred_at", since.toISOString()).order("occurred_at", { ascending: false });
      return data ?? [];
    },
  });

  const openJobs = useQuery({
    queryKey: ["clock-open-jobs"],
    enabled: pickingJob,
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, job_number, complaint, status, bikes(make, model), customers(first_name, last_name)")
        .neq("status", "completed")
        .order("job_number", { ascending: false })
        .limit(50);
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

  // active job for current shift
  const activeJobId = useMemo(() => {
    for (const e of (events.data ?? [])) {
      if (e.event_type === "clock_out") return null;
      if (e.event_type === "clock_in") return (e as any).job_id as string | null;
    }
    return null;
  }, [events.data]);

  const activeJob = useQuery({
    queryKey: ["clock-active-job", activeJobId],
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

  async function add(type: EventType, jobId?: string | null) {
    if (!user) return;
    if (type === "clock_in" && !jobId) {
      setPickingJob(true);
      return;
    }
    const payload: any = { user_id: user.id, event_type: type };
    if (type === "clock_in") payload.job_id = jobId;
    const { error } = await supabase.from("clock_events").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(type.replace("_", " "));
    qc.invalidateQueries({ queryKey: ["clock-events", user.id] });
    qc.invalidateQueries({ queryKey: ["clock-events-floating", user.id] });
    qc.invalidateQueries({ queryKey: ["dashboard-counts"] });
  }

  const filteredJobs = (openJobs.data ?? []).filter((j: any) => {
    if (!jobQuery.trim()) return true;
    const q = jobQuery.toLowerCase();
    const bike = j.bikes ? `${j.bikes.make ?? ""} ${j.bikes.model ?? ""}`.toLowerCase() : "";
    const cust = j.customers ? `${j.customers.first_name ?? ""} ${j.customers.last_name ?? ""}`.toLowerCase() : "";
    return String(j.job_number).includes(q) || bike.includes(q) || cust.includes(q) || (j.complaint ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <header>
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Time Clock</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Your shift</h1>
        {user && (
          <div className="text-sm text-muted-foreground mt-1">
            Logged in as <span className="font-semibold text-foreground">{fullName || user?.email}</span>
          </div>
        )}
      </header>

      <ClockHero
        state={state}
        since={last?.occurred_at}
        jobId={activeJobId ?? undefined}
        jobNumber={(activeJob.data as any)?.job_number}
      />

      {activeJobId && activeJob.data && state !== "off" && (
        <Link
          to="/jobs/$jobId"
          params={{ jobId: activeJobId }}
          className="card-surface p-3 flex items-center gap-3 hover:border-primary/40 transition"
        >
          <Wrench className="h-4 w-4 text-primary" />
          <div className="text-sm flex-1">
            <span className="text-muted-foreground">Working on </span>
            <span className="font-semibold">#{(activeJob.data as any).job_number}</span>
            {(activeJob.data as any).bikes && (
              <span className="text-muted-foreground"> · {(activeJob.data as any).bikes.make} {(activeJob.data as any).bikes.model}</span>
            )}
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        {state === "off" && (
          <Button onClick={() => setPickingJob(true)} className="col-span-2 h-20 text-lg gold-surface font-bold gap-2">
            <LogIn className="h-5 w-5" /> Clock In on Job
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
          {(events.data ?? []).slice(0, 10).map((e: any) => (
            <div key={e.id} className="flex items-center justify-between text-sm border-b border-border/40 last:border-0 py-1.5">
              <span className="capitalize font-medium">
                {e.event_type.replace("_", " ")}
                {e.jobs?.job_number ? <span className="ml-1.5 text-muted-foreground font-normal">· Job #{e.jobs.job_number}</span> : null}
              </span>
              <span className="text-muted-foreground text-xs">{new Date(e.occurred_at).toLocaleString()}</span>
            </div>
          ))}
          {(!events.data || events.data.length === 0) && <p className="text-sm text-muted-foreground">No clock activity yet.</p>}
        </div>
      </section>

      <Dialog open={pickingJob} onOpenChange={setPickingJob}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select a job card to clock in</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Search job #, customer, bike…"
            value={jobQuery}
            onChange={(e) => setJobQuery(e.target.value)}
          />
          <div className="max-h-[50vh] overflow-y-auto space-y-1 -mx-2">
            {filteredJobs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No matching open jobs.</p>
            )}
            {filteredJobs.map((j: any) => (
              <button
                key={j.id}
                onClick={async () => {
                  setPickingJob(false);
                  setJobQuery("");
                  await add("clock_in", j.id);
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary/60 border border-transparent hover:border-border transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">#{j.job_number}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{j.status}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {j.customers ? `${j.customers.first_name ?? ""} ${j.customers.last_name ?? ""}` : ""}
                  {j.bikes ? ` · ${j.bikes.make ?? ""} ${j.bikes.model ?? ""}` : ""}
                </div>
                {j.complaint && <div className="text-xs text-foreground/80 truncate mt-0.5">{j.complaint}</div>}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickingJob(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClockHero({ state, since, jobId, jobNumber }: { state: "off" | "on" | "break"; since?: string; jobId?: string; jobNumber?: number }) {
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
      {jobId && jobNumber ? (
        <Link
          to="/jobs/$jobId"
          params={{ jobId }}
          className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-primary hover:underline"
        >
          <Wrench className="h-3.5 w-3.5" />
          Job #{jobNumber}
        </Link>
      ) : (
        <div className="text-xs text-muted-foreground mt-1">
          {since ? `Since ${new Date(since).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Tap clock in to start your shift"}
        </div>
      )}
    </div>
  );
}
