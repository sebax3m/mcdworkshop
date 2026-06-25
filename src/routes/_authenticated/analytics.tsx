import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import {
  format,
  startOfWeek,
  startOfMonth,
  startOfYear,
  endOfWeek,
  endOfMonth,
  endOfYear,
  subDays,
  parseISO,
} from "date-fns";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, DollarSign, Receipt, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
});

type Inv = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name_snapshot: string | null;
  bike_snapshot: string | null;
  status: string;
  subtotal_excl_gst: number;
  gst: number;
  total: number;
  paid_amount: number;
  paid_on: string | null;
  due_date: string | null;
  snapshot: any;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 2 }).format(n || 0);

function AnalyticsPage() {
  const [fyStart, setFyStart] = useState<"apr" | "jan">("apr"); // NZ FY = Apr–Mar
  const [yearFilter, setYearFilter] = useState<string>("all"); // "all" or "2025" etc.


  const { data: invoices = [] } = useQuery<Inv[]>({
    queryKey: ["analytics-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, invoice_number, invoice_date, customer_name_snapshot, bike_snapshot, status, subtotal_excl_gst, gst, total, paid_amount, paid_on, due_date, snapshot",
        )
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const now = new Date();

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const i of invoices) {
      if (i.invoice_date) set.add(parseISO(i.invoice_date).getFullYear());
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [invoices]);

  const isAll = yearFilter === "all";
  const selectedYear = isAll ? null : Number(yearFilter);

  const scoped = useMemo(() => {
    if (isAll) return invoices;
    return invoices.filter((i) => parseISO(i.invoice_date).getFullYear() === selectedYear);
  }, [invoices, isAll, selectedYear]);

  const totals = useMemo(() => {
    const sum = (rows: Inv[], key: keyof Inv) => rows.reduce((a, r) => a + Number(r[key] || 0), 0);
    const inRange = (d: Date, a: Date, b: Date) => d >= a && d <= b;
    const wkA = startOfWeek(now, { weekStartsOn: 1 });
    const wkB = endOfWeek(now, { weekStartsOn: 1 });
    const mA = startOfMonth(now);
    const mB = endOfMonth(now);
    const yA = fyStart === "apr"
      ? new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1)
      : startOfYear(now);
    const yB = fyStart === "apr"
      ? new Date(yA.getFullYear() + 1, 2, 31)
      : endOfYear(now);

    const week = invoices.filter((i) => inRange(parseISO(i.invoice_date), wkA, wkB));
    const month = invoices.filter((i) => inRange(parseISO(i.invoice_date), mA, mB));
    const last30 = invoices.filter((i) => parseISO(i.invoice_date) >= subDays(now, 30));

    // "Year" KPIs follow the year selector when a specific year is chosen,
    // otherwise fall back to the FY range.
    const yearRows = isAll
      ? invoices.filter((i) => inRange(parseISO(i.invoice_date), yA, yB))
      : scoped;

    return {
      week: { total: sum(week, "total"), count: week.length, gst: sum(week, "gst") },
      month: { total: sum(month, "total"), count: month.length, gst: sum(month, "gst") },
      year: { total: sum(yearRows, "total"), count: yearRows.length, gst: sum(yearRows, "gst"), subtotal: sum(yearRows, "subtotal_excl_gst") },
      last30: { total: sum(last30, "total") },
      outstanding: sum(
        scoped.filter((i) => i.status !== "paid"),
        "total",
      ) - sum(scoped.filter((i) => i.status !== "paid"), "paid_amount"),
      paid: sum(scoped.filter((i) => i.status === "paid"), "total"),
      ytdRange: { from: yA, to: yB },
    };
  }, [invoices, scoped, isAll, fyStart, now]);


  // When viewing a single year: show 12 months Jan–Dec of that year.
  // When viewing All years: show one bar per year.
  const monthlySeries = useMemo(() => {
    if (isAll) {
      const map = new Map<string, { month: string; revenue: number; gst: number }>();
      for (const i of invoices) {
        const key = format(parseISO(i.invoice_date), "yyyy");
        const cur = map.get(key) ?? { month: key, revenue: 0, gst: 0 };
        cur.revenue += Number(i.total);
        cur.gst += Number(i.gst);
        map.set(key, cur);
      }
      return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([, v]) => v);
    }
    const months = Array.from({ length: 12 }, (_, m) => ({
      month: format(new Date(selectedYear!, m, 1), "MMM"),
      revenue: 0,
      gst: 0,
    }));
    for (const i of scoped) {
      const m = parseISO(i.invoice_date).getMonth();
      months[m].revenue += Number(i.total);
      months[m].gst += Number(i.gst);
    }
    return months;
  }, [invoices, scoped, isAll, selectedYear]);

  const weeklySeries = useMemo(() => {
    const map = new Map<string, { week: string; revenue: number }>();
    for (const i of scoped) {
      const d = parseISO(i.invoice_date);
      const ws = startOfWeek(d, { weekStartsOn: 1 });
      const key = format(ws, "yyyy-MM-dd");
      const cur = map.get(key) ?? { week: format(ws, "d MMM"), revenue: 0 };
      cur.revenue += Number(i.total);
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .slice(-12)
      .map(([, v]) => v);
  }, [scoped]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const i of scoped) {
      const n = i.customer_name_snapshot || "Walk-in";
      const cur = map.get(n) ?? { name: n, total: 0, count: 0 };
      cur.total += Number(i.total);
      cur.count += 1;
      map.set(n, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [scoped]);


  const exportXeroCSV = () => {
    // Xero "Sales Invoices" import format
    const header = [
      "ContactName",
      "InvoiceNumber",
      "InvoiceDate",
      "DueDate",
      "Description",
      "Quantity",
      "UnitAmount",
      "AccountCode",
      "TaxType",
      "TrackingName1",
      "TrackingOption1",
      "Currency",
    ];
    const rows: string[][] = [];
    for (const inv of invoices) {
      const lines: any[] = inv.snapshot?.lines ?? [];
      const date = format(parseISO(inv.invoice_date), "dd/MM/yyyy");
      const due = inv.due_date ? format(parseISO(inv.due_date), "dd/MM/yyyy") : date;
      const contact = inv.customer_name_snapshot || "Walk-in customer";
      if (lines.length === 0) {
        rows.push([
          contact,
          inv.invoice_number,
          date,
          due,
          inv.bike_snapshot || "Workshop services",
          "1",
          Number(inv.subtotal_excl_gst || inv.total / 1.15).toFixed(2),
          "200",
          "OUTPUT2",
          "",
          "",
          "NZD",
        ]);
      } else {
        for (const ln of lines) {
          const isLabour = /labour|service|wof/i.test(ln.code || ln.desc || "");
          rows.push([
            contact,
            inv.invoice_number,
            date,
            due,
            `${ln.code ? ln.code + " - " : ""}${(ln.desc || "").replace(/<br\s*\/?>/gi, " | ")}`,
            String(ln.qty ?? 1),
            Number(ln.price ?? 0).toFixed(2),
            isLabour ? "200" : "201", // Sales / Parts sales
            "OUTPUT2", // NZ 15% GST on Income
            "",
            "",
            "NZD",
          ]);
        }
      }
    }
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xero-sales-invoices-${format(now, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Workshop</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Analytics & Tax</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revenue, GST and outstanding balances — formatted for Xero import.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={fyStart}
            onChange={(e) => setFyStart(e.target.value as any)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="apr">NZ FY (Apr–Mar)</option>
            <option value="jan">Calendar year</option>
          </select>
          <Button onClick={exportXeroCSV} className="red-surface">
            <Download className="h-4 w-4 mr-2" /> Export Xero CSV
          </Button>
        </div>
      </header>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="This week" value={fmt(totals.week.total)} sub={`${totals.week.count} invoices`} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="This month" value={fmt(totals.month.total)} sub={`${totals.month.count} invoices`} />
        <Kpi icon={<DollarSign className="h-4 w-4" />} label="FY revenue" value={fmt(totals.year.total)} sub={`Excl GST ${fmt(totals.year.subtotal)}`} />
        <Kpi icon={<Receipt className="h-4 w-4" />} label="GST collected (FY)" value={fmt(totals.year.gst)} sub="To remit to IRD" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Kpi icon={<AlertCircle className="h-4 w-4 text-amber-400" />} label="Outstanding balance" value={fmt(totals.outstanding)} sub="Unpaid invoices" />
        <Kpi icon={<DollarSign className="h-4 w-4 text-emerald-400" />} label="Paid (all time)" value={fmt(totals.paid)} sub="" />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Last 30 days" value={fmt(totals.last30.total)} sub="" />
      </div>

      {/* Monthly stacked bar chart */}
      <div className="card-surface p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold">Revenue by month (last 12)</h2>
          <span className="text-xs text-muted-foreground">Incl. GST</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlySeries}>
              <defs>
                <linearGradient id="barRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#b91c1c" />
                </linearGradient>
                <linearGradient id="barGst" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#a1a1aa" }} stroke="#3f3f46" />
              <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} stroke="#3f3f46" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any) => fmt(Number(v))}
                contentStyle={{ background: "#0a0a0a", border: "1px solid #3f3f46", borderRadius: 8 }}
                labelStyle={{ color: "#fafafa" }}
                itemStyle={{ color: "#fafafa" }}
                cursor={{ fill: "rgba(239,68,68,0.08)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
              <Bar dataKey="revenue" name="Revenue" stackId="a" fill="url(#barRev)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="gst" name="GST" stackId="a" fill="url(#barGst)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly area chart */}
      <div className="card-surface p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-lg font-bold">Revenue by week (last 12)</h2>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklySeries}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.7} />
                  <stop offset="60%" stopColor="#a855f7" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#a1a1aa" }} stroke="#3f3f46" />
              <YAxis tick={{ fontSize: 12, fill: "#a1a1aa" }} stroke="#3f3f46" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any) => fmt(Number(v))}
                contentStyle={{ background: "#0a0a0a", border: "1px solid #3f3f46", borderRadius: 8 }}
                labelStyle={{ color: "#fafafa" }}
                itemStyle={{ color: "#fafafa" }}
                cursor={{ stroke: "#ef4444", strokeWidth: 1, strokeDasharray: "3 3" }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#ef4444" strokeWidth={2.5} fill="url(#revGrad)" dot={{ r: 4, fill: "#3b82f6", stroke: "#0a0a0a", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#ef4444", stroke: "#fafafa", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top customers with mini bars */}
      <div className="card-surface p-5">
        <h2 className="font-display text-lg font-bold mb-4">Top customers</h2>
        <div className="space-y-4">
          {topCustomers.map((c, i) => {
            const max = topCustomers[0]?.total || 1;
            const pct = (c.total / max) * 100;
            const hues = [
              "oklch(0.58 0.22 25)",   // red
              "oklch(0.50 0.08 255)",  // blue
              "oklch(0.78 0.15 60)",   // amber
              "oklch(0.78 0.16 150)",  // green
              "oklch(0.62 0.2 320)",   // purple
              "oklch(0.55 0.10 200)",  // teal
              "oklch(0.65 0.12 40)",   // orange
              "oklch(0.55 0.08 280)",  // indigo
            ];
            return (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: hues[i % hues.length] }}>
                      {i + 1}
                    </span>
                    <span className="font-medium text-sm">{c.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-display font-bold text-sm">{fmt(c.total)}</div>
                    <div className="text-[10px] text-muted-foreground">{c.count} invoice{c.count === 1 ? "" : "s"}</div>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: hues[i % hues.length] }} />
                </div>
              </div>
            );
          })}
          {topCustomers.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No invoices yet.</p>
          )}
        </div>
      </div>

      <div className="card-surface p-5">
        <h2 className="font-display text-lg font-bold mb-2">About the Xero export</h2>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li>NZ 15% GST is applied (TaxType <code className="text-foreground">OUTPUT2</code>).</li>
          <li>Labour & service items map to account <code className="text-foreground">200 — Sales</code>; parts map to <code className="text-foreground">201 — Parts sales</code>.</li>
          <li>Dates are formatted DD/MM/YYYY (NZ).</li>
          <li>Upload in Xero via <em>Business → Invoices → Import</em>.</li>
        </ul>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="font-display text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
