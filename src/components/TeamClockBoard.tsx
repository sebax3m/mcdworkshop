/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Coffee, CircleDot, Wrench } from "lucide-react";

type Status = "on" | "break" | "off";

type Row = {
  userId: string;
  name: string;
  role: string;
  status: Status;
  since: string | null;
  jobId: string | null;
  jobNumber: number | null;
};

function elapsed(since: string | null, now: number) {
  if (!since) return "—:—:—";
  const sec = Math.max(0, Math.floor((now - +new Date(since)) / 1000));
  const h = Math.floor(sec / 3600),
    m = Math.floor((sec % 3600) / 60),
    s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function TeamClockBoard() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const board = useQuery({
    queryKey: ["team-clock-board"],
    refetchInterval: 15000,
    queryFn: async (): Promise<Row[]> => {
      const [{ data: roles }, { data: profiles }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("id, full_name, email"),
      ]);
      const since = new Date();
      since.setDate(since.getDate() - 2);
      const { data: events } = await supabase
        .from("clock_events")
        .select("user_id, event_type, occurred_at, job_id, jobs(job_number)")
        .gte("occurred_at", since.toISOString())
        .order("occurred_at", { ascending: false });

      const latest = new Map<string, any>();
      const lastIn = new Map<string, any>();
      for (const e of (events ?? []) as any[]) {
        if (!latest.has(e.user_id)) latest.set(e.user_id, e);
        if (e.event_type === "clock_in" && !lastIn.has(e.user_id)) lastIn.set(e.user_id, e);
      }

      const roleByUser = new Map<string, string>();
      (roles ?? []).forEach((r: any) => {
        const cur = roleByUser.get(r.user_id);
        if (!cur || r.role === "admin") roleByUser.set(r.user_id, r.role);
      });

      return (profiles ?? [])
        .filter((p: any) => roleByUser.get(p.id) === "technician")
        .map((p: any) => {
          const last = latest.get(p.id);
          const status: Status = !last
            ? "off"
            : last.event_type === "clock_in" || last.event_type === "break_end"
              ? "on"
              : last.event_type === "break_start"
                ? "break"
                : "off";
          const inEv = status === "off" ? null : lastIn.get(p.id);
          return {
            userId: p.id,
            name: p.full_name || p.email || "Technician",
            role: roleByUser.get(p.id) ?? "technician",
            status,
            since: last?.occurred_at ?? null,
            jobId: inEv?.job_id ?? null,
            jobNumber: inEv?.jobs?.job_number ?? null,
          } as Row;
        })
        .sort((a, b) => {
          const rank = { on: 0, break: 1, off: 2 } as const;
          return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name);
        });
    },
  });

  const rows = board.data ?? [];
  const onCount = rows.filter((r) => r.status === "on").length;
  const breakCount = rows.filter((r) => r.status === "break").length;

  return (
    <section className="card-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg font-semibold">Live technician status</h2>
        <div className="text-xs text-muted-foreground">
          <span className="text-status-ready font-semibold">{onCount} working</span> ·{" "}
          <span className="text-status-progress font-semibold">{breakCount} on break</span> ·{" "}
          {rows.length - onCount - breakCount} off
        </div>
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No technicians found.</p>
        )}
        {rows.map((r) => (
          <div
            key={r.userId}
            className={`flex items-center gap-3 rounded-xl border p-3 ${
              r.status === "on"
                ? "border-status-ready/40 bg-status-ready/5"
                : r.status === "break"
                  ? "border-status-progress/40 bg-status-progress/5"
                  : "border-border"
            }`}
          >
            <CircleDot
              className={`h-4 w-4 shrink-0 ${
                r.status === "on"
                  ? "text-status-ready animate-pulse"
                  : r.status === "break"
                    ? "text-status-progress"
                    : "text-muted-foreground"
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="font-semibold truncate">{r.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                {r.status === "on" && "Clocked in"}
                {r.status === "break" && (
                  <>
                    <Coffee className="h-3 w-3" /> On break
                  </>
                )}
                {r.status === "off" && "Clocked out"}
                {r.since && (
                  <span>
                    · since{" "}
                    {new Date(r.since).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
              {r.status !== "off" && r.jobId && r.jobNumber != null && (
                <Link
                  to="/jobs/$jobId"
                  params={{ jobId: r.jobId }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mt-0.5"
                >
                  <Wrench className="h-3 w-3" /> Job #{r.jobNumber}
                </Link>
              )}
            </div>
            <div className="font-display text-xl font-bold tabular-nums shrink-0">
              {r.status === "off" ? "—:—:—" : elapsed(r.since, now)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
