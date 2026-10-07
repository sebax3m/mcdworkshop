/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { format, startOfWeek, subWeeks } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 2 }).format(
    n || 0,
  );

function isDynoLine(p: { name?: string | null; part_number?: string | null; supplier?: string | null }) {
  const pn = (p.part_number ?? "").toLowerCase();
  if (pn.startsWith("dyno")) return true;
  const name = (p.name ?? "").toLowerCase();
  if (name.startsWith("dyno")) return true;
  const text = `${name} ${(p.supplier ?? "").toLowerCase()}`;
  return text.includes("custom tune") || text.includes("dyno");
}

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

export function DynoAnalytics({ from, to, label }: { from: Date | null; to: Date | null; label: string | null }) {
  const start = from ?? startOfWeek(subWeeks(new Date(), 11), { weekStartsOn: 1 });
  const end = to ?? new Date();
  const endInclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
  const key = [ymd(start), ymd(end)];

  const data = useQuery({
    queryKey: ["dyno-analytics", ...key],
    queryFn: async () => {
      const { data: entries, error: e1 } = await supabase
        .from("time_entries")
        .select("id, job_id, technician_id, started_at, ended_at, minutes")
        .eq("work_type", "dyno")
        .gte("started_at", start.toISOString())
        .lte("started_at", endInclusive.toISOString());
      if (e1) throw e1;
      const { data: invoices, error: e2 } = await supabase
        .from("invoices")
        .select("id, invoice_number, invoice_date, customer_name_snapshot, bike_snapshot, job_id, status")
        .gte("invoice_date", ymd(start))
        .lte("invoice_date", ymd(end))
        .neq("status", "void");
      if (e2) throw e2;
      const jobIds = Array.from(new Set((invoices ?? []).map((i: any) => i.job_id).filter(Boolean)));
      let parts: any[] = [];
      for (let i = 0; i < jobIds.length; i += 150) {
        const { data: p } = await supabase
          .from("parts")
          .select("job_id, name, part_number, supplier, quantity, retail, discount_pct, on_invoice")
          .in("job_id", jobIds.slice(i, i + 150));
        parts = parts.concat(p ?? []);
      }
      const techIds = Array.from(new Set((entries ?? []).map((e: any) => e.technician_id)));
      const { data: profiles } = techIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", techIds)
        : { data: [] as any[] };
      return { entries: entries ?? [], invoices: invoices ?? [], parts, profiles: profiles ?? [] };
    },
  });
  void fetchAllRows;

  const view = useMemo(() => {
    const d = data.data;
    if (!d) return null;
    const mins = (e: any) =>
      e.minutes ?? Math.max(0, Math.round(((e.ended_at ? +new Date(e.ended_at) : Date.now()) - +new Date(e.started_at)) / 60000));
    const minsByJob = new Map<string, number>();
    const weeks = new Map<string, number>();
    const byTech = new Map<string, number>();
    let totalMin = 0;
    for (const e of d.entries as any[]) {
      const m = mins(e);
      totalMin += m;
      minsByJob.set(e.job_id, (minsByJob.get(e.job_id) ?? 0) + m);
      const wk = format(startOfWeek(new Date(e.started_at), { weekStartsOn: 1 }), "dd MMM");
      weeks.set(wk, (weeks.get(wk) ?? 0) + m);
      byTech.set(e.technician_id, (byTech.get(e.technician_id) ?? 0) + m);
    }
    const revByJob = new Map<string, number>();
    for (const p of d.parts) {
      if (p.on_invoice === false || !isDynoLine(p)) continue;
      const v = Number(p.retail || 0) * Number(p.quantity || 1) * (1 - Number(p.discount_pct || 0) / 100);
      revByJob.set(p.job_id, (revByJob.get(p.job_id) ?? 0) + v);
    }
    const rows = (d.invoices as any[])
      .filter((i) => i.job_id && revByJob.has(i.job_id))
      .map((i) => ({ ...i, revenue: revByJob.get(i.job_id) ?? 0, minutes: minsByJob.get(i.job_id) ?? 0 }))
      .sort((a, b) => (a.invoice_date < b.invoice_date ? 1 : -1));
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    // chronological weekly series
    const series: { week: string; hours: number }[] = [];
    const cur = startOfWeek(start, { weekStartsOn: 1 });
    while (cur <= endInclusive) {
      const k = format(cur, "dd MMM");
      series.push({ week: k, hours: Math.round(((weeks.get(k) ?? 0) / 60) * 10) / 10 });
      cur.setDate(cur.getDate() + 7);
    }
    const names = new Map((d.profiles as any[]).map((p) => [p.id, p.full_name]));
    const techs = Array.from(byTech.entries())
      .map(([id, m]) => ({ name: names.get(id) || "Unknown", hours: m / 60 }))
      .sort((a, b) => b.hours - a.hours);
    const hours = totalMin / 60;
    const weeksCount = Math.max(1, series.length);
    return { hours, revenue, perHour: hours > 0 ? revenue / hours : 0, avgWeek: hours / weeksCount, series, rows, techs };
  }, [data.data, start, endInclusive]);

  return (
    <div className="card-surface p-5 space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Zap className="h-5 w-5 text-status-dyno" /> Dyno &amp; Tuning
        </h2>
        <span className="text-xs text-muted-foreground">
          {label ?? "Last 12 weeks"} · {format(start, "dd MMM yyyy")} – {format(end, "dd MMM yyyy")}
        </span>
      </div>
      {!view ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Dyno hours" value={`${view.hours.toFixed(1)} h`} />
            <Stat label="Avg per week" value={`${view.avgWeek.toFixed(1)} h`} />
            <Stat label="Tuning invoiced" value={fmt(view.revenue)} sub={`${view.rows.length} invoice${view.rows.length === 1 ? "" : "s"}`} />
            <Stat label="$ per dyno hour" value={view.hours > 0 ? fmt(view.perHour) : "—"} />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={view.series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} unit="h" />
                <Tooltip formatter={(v: any) => [`${v} h`, "Dyno"]} />
                <Bar dataKey="hours" fill="var(--status-dyno)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {view.techs.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {view.techs.map((t) => (
                <span key={t.name} className="rounded-md border border-border px-2 py-1">
                  {t.name}: <b>{t.hours.toFixed(1)} h</b>
                </span>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="py-2 pr-3">Invoice</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Bike</th>
                  <th className="py-2 pr-3 text-right">Dyno hours</th>
                  <th className="py-2 text-right">Tuning</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="py-2 pr-3 font-medium">{r.invoice_number}</td>
                    <td className="py-2 pr-3">{r.invoice_date}</td>
                    <td className="py-2 pr-3">{r.customer_name_snapshot ?? "—"}</td>
                    <td className="py-2 pr-3">{r.bike_snapshot ?? "—"}</td>
                    <td className="py-2 pr-3 text-right">{r.minutes ? `${(r.minutes / 60).toFixed(1)} h` : "—"}</td>
                    <td className="py-2 text-right font-bold">{fmt(r.revenue)}</td>
                  </tr>
                ))}
                {view.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-muted-foreground">
                      No tuning invoices in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-display text-xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
