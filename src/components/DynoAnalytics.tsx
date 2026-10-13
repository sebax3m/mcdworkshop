/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { format, startOfMonth, subMonths } from "date-fns";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Pencil, Search, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 2 }).format(
    n || 0,
  );

function isDynoLine(p: { name?: string | null; part_number?: string | null; supplier?: string | null }) {
  const pn = (p.part_number ?? "").toLowerCase();
  if (pn.startsWith("dyno") || pn === "pv-license") return true;
  const name = (p.name ?? "").toLowerCase();
  if (name.startsWith("dyno")) return true;
  const text = `${name} ${(p.supplier ?? "").toLowerCase()}`;
  return text.includes("custom tune") || text.includes("dyno");
}

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

// Tuning cost model (NZD). Tuner labour is charged per dyno hour; platform cost per bike.
const TUNER_RATE = 60;
const ALIENTECH_ANNUAL = 1800;
type Platform = "powervision" | "woolich" | "alientech" | "tuneecu";
const PLATFORMS: Record<Platform, { label: string; cost: number }> = {
  powervision: { label: "Power Vision", cost: 490 },
  woolich: { label: "Woolich Racing", cost: 190 },
  alientech: { label: "Alientech (XDF)", cost: 180 },
  tuneecu: { label: "TuneECU", cost: 0 },
};

function detectPlatform(text: string, bike: string, revenue: number, hd: boolean): Platform {
  const t = text.toLowerCase();
  const b = bike.toLowerCase();
  if (t.includes("alientech") || t.includes("xdf") || t.includes("reprogram")) return "alientech";
  if (t.includes("woolich")) return "woolich";
  if (t.includes("tuneecu") || t.includes("tune ecu")) return "tuneecu";
  if (t.includes("power vision") || t.includes("powervision") || hd || /harley|indian/.test(b)) return "powervision";
  if (Math.abs(revenue - 850) < 1) return "tuneecu";
  if (revenue >= 1150) return "alientech";
  return "woolich";
}

export function DynoAnalytics() {
  const defStart = startOfMonth(subMonths(new Date(), 5));
  const [fromStr, setFromStr] = useState(ymd(defStart));
  const [toStr, setToStr] = useState(ymd(new Date()));
  const [chart, setChart] = useState<"money" | "hours">("money");
  const [selected, setSelected] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const changePlatform = async (jobId: string, platform: Platform) => {
    setSaving(true);
    try {
      const { data: job, error } = await supabase.from("jobs").select("service_data").eq("id", jobId).single();
      if (error) throw error;
      const sd = { ...((job?.service_data as any) ?? {}), tuning_platform: platform };
      const { error: e2 } = await supabase.from("jobs").update({ service_data: sd }).eq("id", jobId);
      if (e2) throw e2;
      await qc.invalidateQueries({ queryKey: ["dyno-analytics"] });
      setSelected((s: any) => (s ? { ...s, platform } : s));
      toast.success("Platform updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update platform");
    } finally {
      setSaving(false);
    }
  };
  const start = fromStr ? new Date(`${fromStr}T00:00:00`) : defStart;
  const end = toStr ? new Date(`${toStr}T00:00:00`) : new Date();
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
      const jobsSd: any[] = [];
      for (let i = 0; i < jobIds.length; i += 150) {
        const { data: js } = await supabase.from("jobs").select("id, service_data").in("id", jobIds.slice(i, i + 150));
        jobsSd.push(...(js ?? []));
      }
      const platformByJob = new Map<string, string>(
        jobsSd.filter((x) => x.service_data?.tuning_platform).map((x) => [x.id, x.service_data.tuning_platform]),
      );
      const techIds = Array.from(new Set((entries ?? []).map((e: any) => e.technician_id)));
      const { data: profiles } = techIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", techIds)
        : { data: [] as any[] };
      return { entries: entries ?? [], invoices: invoices ?? [], parts, profiles: profiles ?? [], platformByJob };
    },
  });

  const view = useMemo(() => {
    const d = data.data;
    if (!d) return null;
    const mins = (e: any) =>
      e.minutes ?? Math.max(0, Math.round(((e.ended_at ? +new Date(e.ended_at) : Date.now()) - +new Date(e.started_at)) / 60000));
    const minsByJob = new Map<string, number>();
    const months = new Map<string, number>();
    const byTech = new Map<string, number>();
    let totalMin = 0;
    for (const e of d.entries as any[]) {
      const m = mins(e);
      totalMin += m;
      minsByJob.set(e.job_id, (minsByJob.get(e.job_id) ?? 0) + m);
      const mo = format(startOfMonth(new Date(e.started_at)), "MMM yyyy");
      months.set(mo, (months.get(mo) ?? 0) + m);
      byTech.set(e.technician_id, (byTech.get(e.technician_id) ?? 0) + m);
    }
    const revByJob = new Map<string, number>();
    const textByJob = new Map<string, string>();
    const hdByJob = new Set<string>();
    for (const p of d.parts) {
      if (p.on_invoice === false || !isDynoLine(p)) continue;
      const v = Number(p.retail || 0) * Number(p.quantity || 1) * (1 - Number(p.discount_pct || 0) / 100);
      revByJob.set(p.job_id, (revByJob.get(p.job_id) ?? 0) + v);
      textByJob.set(p.job_id, `${textByJob.get(p.job_id) ?? ""} ${p.part_number ?? ""} ${p.name ?? ""} ${p.supplier ?? ""}`);
      if ((p.part_number ?? "").toLowerCase().startsWith("dynohd")) hdByJob.add(p.job_id);
    }
    const rows = (d.invoices as any[])
      .filter((i) => i.job_id && revByJob.has(i.job_id))
      .map((i) => {
        const revenue = revByJob.get(i.job_id) ?? 0;
        const minutes = minsByJob.get(i.job_id) ?? 0;
        const platform = ((d as any).platformByJob.get(i.job_id) as Platform | undefined) ?? detectPlatform(textByJob.get(i.job_id) ?? "", i.bike_snapshot ?? "", revenue, hdByJob.has(i.job_id));
        const tunerCost = (minutes / 60) * TUNER_RATE;
        const toolCost = PLATFORMS[platform].cost;
        return { ...i, revenue, minutes, platform, tunerCost, toolCost, profit: revenue - tunerCost - toolCost };
      })
      .sort((a, b) => (a.invoice_date < b.invoice_date ? 1 : -1));
    const revenue = rows.reduce((s, r) => s + r.revenue, 0);
    const days = Math.max(1, Math.round((+endInclusive - +start) / 86400000));
    const licenseShare = (ALIENTECH_ANNUAL * days) / 365;
    const tunerCost = (totalMin / 60) * TUNER_RATE;
    const toolCost = rows.reduce((s, r) => s + r.toolCost, 0) + licenseShare;
    const profit = revenue - tunerCost - toolCost;
    // chronological monthly series
    const finByMonth = new Map<string, { revenue: number; costs: number; profit: number; jobs: number }>();
    for (const r of rows) {
      const k = format(startOfMonth(new Date(`${r.invoice_date}T00:00:00`)), "MMM yyyy");
      const f = finByMonth.get(k) ?? { revenue: 0, costs: 0, profit: 0, jobs: 0 };
      f.revenue += r.revenue; f.costs += r.tunerCost + r.toolCost; f.profit += r.profit; f.jobs += 1;
      finByMonth.set(k, f);
    }
    const series: { month: string; hours: number; revenue: number; costs: number; profit: number; jobs: number }[] = [];
    const cur = startOfMonth(start);
    while (cur <= endInclusive) {
      const k = format(cur, "MMM yyyy");
      const f = finByMonth.get(k) ?? { revenue: 0, costs: 0, profit: 0, jobs: 0 };
      series.push({ month: format(cur, "MMM yy"), hours: Math.round(((months.get(k) ?? 0) / 60) * 10) / 10, ...f });
      cur.setMonth(cur.getMonth() + 1);
    }
    const platformMix = (Object.keys(PLATFORMS) as Platform[]).map((p) => {
      const rs = rows.filter((r) => r.platform === p);
      return { key: p, label: PLATFORMS[p].label, count: rs.length, revenue: rs.reduce((s, r) => s + r.revenue, 0), profit: rs.reduce((s, r) => s + r.profit, 0) };
    });
    const names = new Map((d.profiles as any[]).map((p) => [p.id, p.full_name]));
    const techs = Array.from(byTech.entries())
      .map(([id, m]) => ({ name: names.get(id) || "Unknown", hours: m / 60 }))
      .sort((a, b) => b.hours - a.hours);
    const hours = totalMin / 60;
    const monthsCount = Math.max(1, series.length);
    return {
      hours, revenue, perHour: hours > 0 ? revenue / hours : 0, avgMonth: hours / monthsCount, series, rows, techs, platformMix,
      tunerCost, toolCost, licenseShare, profit, margin: revenue > 0 ? (profit / revenue) * 100 : 0,
      profitPerHour: hours > 0 ? profit / hours : 0,
    };
  }, [data.data, start, endInclusive]);

  return (
    <div className="card-surface p-5 space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Zap className="h-5 w-5 text-status-dyno" /> Dyno &amp; Tuning
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="date"
            value={fromStr}
            max={toStr}
            onChange={(e) => setFromStr(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            aria-label="From date"
          />
          <span>–</span>
          <input
            type="date"
            value={toStr}
            min={fromStr}
            onChange={(e) => setToStr(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            aria-label="To date"
          />
        </div>
      </div>
      {!view ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Dyno hours" value={`${view.hours.toFixed(1)} h`} />
            <Stat label="Avg per month" value={`${view.avgMonth.toFixed(1)} h`} />
            <Stat label="Tuning invoiced" value={fmt(view.revenue)} sub={`${view.rows.length} invoice${view.rows.length === 1 ? "" : "s"}`} />
            <Stat label="$ per dyno hour" value={view.hours > 0 ? fmt(view.perHour) : "—"} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Tuner cost ($60/h)" value={fmt(view.tunerCost)} sub={`${view.hours.toFixed(1)} h × $${TUNER_RATE}`} />
            <Stat label="Licences & tools" value={fmt(view.toolCost)} sub={`incl. Alientech yearly share ${fmt(view.licenseShare)}`} />
            <Stat label="Net profit" value={fmt(view.profit)} sub={`${view.margin.toFixed(0)}% margin`} />
            <Stat label="Profit per dyno hour" value={view.hours > 0 ? fmt(view.profitPerHour) : "—"} />
          </div>
          <div className="flex items-center gap-2">
            {(["money", "hours"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setChart(m)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${chart === m ? "bg-status-dyno text-background" : "border border-border text-muted-foreground"}`}
              >
                {m === "money" ? "Revenue vs costs vs profit" : "Dyno hours"}
              </button>
            ))}
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {chart === "money" ? (
                <ComposedChart data={view.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `$${Math.round(v / 100) / 10}k`} />
                  <Tooltip
                    formatter={(v: any, n: any) => [fmt(Number(v)), n]}
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Tuning revenue" fill="var(--status-dyno)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="costs" name="Costs" fill="var(--muted-foreground)" radius={[4, 4, 0, 0]} />
                  <Line dataKey="profit" name="Net profit" type="monotone" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 4 }} />
                </ComposedChart>
              ) : (
                <BarChart data={view.series}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} unit="h" />
                  <Tooltip
                    formatter={(v: any, n: any) => [n === "jobs" ? v : `${v} h`, n === "jobs" ? "Tuning jobs" : "Dyno hours"]}
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                  />
                  <Bar dataKey="hours" name="hours" fill="var(--status-dyno)" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fill: "var(--muted-foreground)" }} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {view.platformMix.map((p) => {
              const max = Math.max(1, ...view.platformMix.map((x) => x.revenue));
              return (
                <div key={p.key} className="rounded-lg border border-border p-3">
                  <div className="text-xs font-semibold">{p.label}</div>
                  <div className="text-xs text-muted-foreground">{p.count} job{p.count === 1 ? "" : "s"} · {fmt(p.revenue)}</div>
                  <div className="h-1.5 mt-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-status-dyno" style={{ width: `${(p.revenue / max) * 100}%` }} />
                  </div>
                  <div className="text-xs mt-1">Profit <b>{fmt(p.profit)}</b></div>
                </div>
              );
            })}
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
                  <th className="py-2 pr-3">Platform</th>
                  <th className="py-2 pr-3 text-right">Tuning</th>
                  <th className="py-2 pr-3 text-right">Costs</th>
                  <th className="py-2 pr-3 text-right">Profit</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(r)}>
                    <td className="py-2 pr-3 font-medium">{r.invoice_number}</td>
                    <td className="py-2 pr-3">{r.invoice_date}</td>
                    <td className="py-2 pr-3">{r.customer_name_snapshot ?? "—"}</td>
                    <td className="py-2 pr-3">{r.bike_snapshot ?? "—"}</td>
                    <td className="py-2 pr-3 text-right">{r.minutes ? `${(r.minutes / 60).toFixed(1)} h` : "—"}</td>
                    <td className="py-2 pr-3">{PLATFORMS[r.platform as Platform].label} ({fmt(r.toolCost)})</td>
                    <td className="py-2 pr-3 text-right font-bold">{fmt(r.revenue)}</td>
                    <td className="py-2 pr-3 text-right text-muted-foreground">{fmt(r.toolCost + r.tunerCost)}</td>
                    <td className={`py-2 pr-3 text-right font-bold ${r.profit < 0 ? "text-destructive" : ""}`}>{fmt(r.profit)}</td>
                    <td className="py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => setSelected(r)} title="Analyze">
                        <Search className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" asChild title="Edit invoice">
                        <Link to="/invoices/$invoiceId" params={{ invoiceId: r.id }}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {view.rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-4 text-muted-foreground">
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
