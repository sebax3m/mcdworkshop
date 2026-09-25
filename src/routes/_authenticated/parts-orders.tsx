/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Package, Search, AlertTriangle, Pencil, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PART_STATUSES,
  SUPPLIERS,
  StatusBadge,
  OverallBadge,
  overallStatus,
  statusPatch,
  useInvalidateParts,
  type PartStatus,
} from "@/lib/parts-orders";
import { PartEditDialog } from "@/components/parts/PartEditDialog";
import { fmtD } from "@/components/parts/fmt";
import { cn } from "@/lib/utils";

type Search = { bookingId?: string; status?: string };

export const Route = createFileRoute("/_authenticated/parts-orders")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    bookingId: typeof s.bookingId === "string" ? s.bookingId : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Parts Orders — Motorcycle Doctors Workshop" },
      { name: "description", content: "Parts logistics control centre: what to order, what's ordered and what has arrived for every book-in." },
      { property: "og:title", content: "Parts Orders — Motorcycle Doctors Workshop" },
      { property: "og:description", content: "Parts logistics control centre for every book-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartsOrdersPage,
});

const CARDS: { key: PartStatus; label: string }[] = [
  { key: "needs_ordering", label: "Needs ordering" },
  { key: "ordered", label: "Ordered" },
  { key: "partially_received", label: "Partially received" },
  { key: "arrived", label: "Arrived" },
  { key: "backordered", label: "Backordered / issue" },
];

function PartsOrdersPage() {
  const search = Route.useSearch();
  const nav = useNavigate({ from: "/parts-orders" });
  const invalidate = useInvalidateParts();
  const [q, setQ] = useState("");
  const [supplier, setSupplier] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ["parts-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_parts")
        .select(
          "*, bookings(id, scheduled_date, service_type, service_type_other, rego, parts_required, customers(first_name,last_name), motorcycles(year,make,model,rego))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
  // Book-ins flagged "parts required" that have no parts yet.
  const flagged = useQuery({
    queryKey: ["parts-orders", "flagged"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, scheduled_date, service_type, rego, customers(first_name,last_name), motorcycles(year,make,model,rego), booking_parts(id)")
        .eq("parts_required", true)
        .gte("scheduled_date", format(addDays(new Date(), -30), "yyyy-MM-dd"));
      if (error) throw error;
      return ((data ?? []) as any[]).filter((b) => !(b.booking_parts ?? []).length);
    },
  });

  const rows = data.data ?? [];
  const soon = format(addDays(new Date(), 3), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const byBooking = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of rows) m.set(r.booking_id, [...(m.get(r.booking_id) ?? []), r]);
    return m;
  }, [rows]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    c.needs_ordering = (c.needs_ordering ?? 0) + (flagged.data?.length ?? 0);
    return c;
  }, [rows, flagged.data]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => (search.bookingId ? r.booking_id === search.bookingId : true))
      .filter((r) => (search.status ? r.status === search.status : showCancelled || r.status !== "cancelled"))
      .filter((r) => (supplier ? r.supplier === supplier : true))
      .filter((r) => (from ? (r.bookings?.scheduled_date ?? "") >= from : true))
      .filter((r) => (to ? (r.bookings?.scheduled_date ?? "") <= to : true))
      .filter((r) => {
        if (!t) return true;
        const b = r.bookings ?? {};
        const hay = [
          r.description, r.part_number, r.supplier, r.order_ref, r.notes,
          b.customers?.first_name, b.customers?.last_name,
          b.motorcycles?.make, b.motorcycles?.model, b.motorcycles?.rego, b.rego,
          b.service_type, String(r.booking_id).slice(0, 8),
        ].join(" ").toLowerCase();
        return hay.includes(t);
      })
      .sort((a, b) => {
        const da = a.bookings?.scheduled_date ?? "9999";
        const db = b.bookings?.scheduled_date ?? "9999";
        return da.localeCompare(db);
      });
  }, [rows, q, supplier, from, to, search.bookingId, search.status, showCancelled]);

  const notReady = (r: any) =>
    r.bookings?.scheduled_date &&
    r.bookings.scheduled_date >= today &&
    r.bookings.scheduled_date <= soon &&
    !["arrived", "cancelled"].includes(r.status);

  async function quick(p: any, status: PartStatus) {
    const { error } = await supabase.from("booking_parts").update(statusPatch(p, status)).eq("id", p.id);
    if (error) return toast.error(error.message);
    invalidate();
  }

  const who = (b: any) => [b?.customers?.first_name, b?.customers?.last_name].filter(Boolean).join(" ") || "—";
  const bike = (b: any) => [b?.motorcycles?.year, b?.motorcycles?.make, b?.motorcycles?.model].filter(Boolean).join(" ");
  const rego = (b: any) => b?.motorcycles?.rego || b?.rego || "";
  const svc = (b: any) => (b?.service_type === "Other" ? b?.service_type_other || "Other" : b?.service_type) ?? "";
  const bookingFilter = search.bookingId ? rows.find((r) => r.booking_id === search.bookingId)?.bookings : null;

  const Actions = ({ r }: { r: any }) => (
    <div className="flex gap-1 justify-end">
      {r.status === "needs_ordering" && (
        <button onClick={() => setEdit({ ...r, status: "ordered" })} className="rounded-md border border-sky-500/60 px-2 h-7 text-[0.625rem] font-bold uppercase text-sky-300 hover:bg-sky-500/15 whitespace-nowrap">Ordered</button>
      )}
      {["ordered", "partially_received", "backordered"].includes(r.status) && (
        <button onClick={() => quick(r, "arrived")} className="rounded-md border border-emerald-500/60 px-2 h-7 text-[0.625rem] font-bold uppercase text-emerald-300 hover:bg-emerald-500/15">Arrived</button>
      )}
      <button onClick={() => setEdit(r)} className="grid h-7 w-7 place-items-center rounded-md border border-border hover:border-primary/50" aria-label="Edit">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-4 pt-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Package className="h-6 w-6 text-sky-400" />
        <h1 className="font-display text-2xl font-bold leading-none">Parts Orders</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {CARDS.map((c) => {
          const m = PART_STATUSES.find((s) => s.key === c.key)!;
          const active = search.status === c.key;
          return (
            <button
              key={c.key}
              onClick={() => nav({ search: (s: Search) => ({ ...s, status: active ? undefined : c.key }) })}
              className={cn("rounded-xl border p-3 text-left transition", m.cls, active ? "ring-2 ring-offset-0 ring-current" : "hover:opacity-90")}
            >
              <div className="text-[0.625rem] font-bold uppercase tracking-wider">{c.label}</div>
              <div className="font-display text-3xl font-bold tabular-nums">{counts[c.key] ?? 0}</div>
            </button>
          );
        })}
      </div>

      {(flagged.data ?? []).length > 0 && !search.bookingId && (
        <div className="space-y-1.5">
          {(flagged.data ?? []).map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-500/50 bg-orange-500/10 px-3 py-2 text-sm">
              <OverallBadge status="required" />
              <span className="font-semibold">{who(b)}</span>
              <span className="text-muted-foreground">{bike(b)} · {fmtD(b.scheduled_date)}</span>
              <span className="text-xs text-muted-foreground">No parts listed yet</span>
              <button onClick={() => setAddFor(b.id)} className="ml-auto inline-flex items-center gap-1 rounded-md border border-orange-500/60 px-2 h-7 text-[0.625rem] font-bold uppercase text-orange-300">
                <Plus className="h-3 w-3" /> Add parts
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customer, bike, rego, part, part number, order ref…"
            className="w-full h-9 rounded-md border border-border bg-background pl-8 pr-2 text-sm"
          />
        </div>
        <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
          <option value="">All suppliers</option>
          {SUPPLIERS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select
          value={search.status ?? ""}
          onChange={(e) => nav({ search: (s: Search) => ({ ...s, status: e.target.value || undefined }) })}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Active statuses</option>
          {PART_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Booking from" className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Booking to" className="h-9 rounded-md border border-border bg-background px-2 text-sm" />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Show cancelled
        </label>
      </div>

      {search.bookingId && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          <span className="font-semibold">Book-in:</span>
          <span>{bookingFilter ? `${who(bookingFilter)} · ${bike(bookingFilter)} · ${fmtD(bookingFilter.scheduled_date)}` : search.bookingId.slice(0, 8)}</span>
          {byBooking.get(search.bookingId) && (
            <OverallBadge status={overallStatus(byBooking.get(search.bookingId)!, true)!} />
          )}
          <button onClick={() => setAddFor(search.bookingId!)} className="inline-flex items-center gap-1 rounded-md red-surface px-2 h-7 text-[0.625rem] font-bold uppercase">
            <Plus className="h-3 w-3" /> Add part
          </button>
          <Link to="/bookings/$bookingId" params={{ bookingId: search.bookingId }} className="text-xs underline">Open book-in</Link>
          <button onClick={() => nav({ search: (s: Search) => ({ ...s, bookingId: undefined }) })} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      )}

      {data.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading parts…</div>
      ) : filtered.length === 0 ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">No parts match these filters.</div>
      ) : (
        <>
          {/* Mobile / tablet cards */}
          <div className="space-y-2 lg:hidden">
            {filtered.map((r) => (
              <div key={r.id} className={cn("card-surface p-3 space-y-1.5", notReady(r) && "ring-1 ring-red-500/60")}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{r.description} {r.part_number && <span className="text-muted-foreground font-normal">· {r.part_number}</span>}</div>
                    <Link to="/bookings/$bookingId" params={{ bookingId: r.booking_id }} className="text-xs text-muted-foreground hover:underline">
                      {fmtD(r.bookings?.scheduled_date)} · {who(r.bookings)} · {bike(r.bookings)} {rego(r.bookings)}
                    </Link>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {[`Qty ${r.qty_received}/${r.qty_required}`, r.supplier, r.order_ref && `#${r.order_ref}`, r.eta && `ETA ${fmtD(r.eta)}`].filter(Boolean).join(" · ")}
                </div>
                <div className="flex items-center">
                  {notReady(r) && <span className="inline-flex items-center gap-1 text-[0.625rem] font-bold uppercase text-red-400"><AlertTriangle className="h-3 w-3" /> Parts not ready</span>}
                  <div className="ml-auto"><Actions r={r} /></div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block card-surface overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  {["Book-in", "Date", "Customer", "Motorcycle", "Rego", "Service", "Part", "Part #", "Qty", "Supplier", "Order ref", "Ordered", "ETA", "Status", "Notes", ""].map((h) => (
                    <th key={h} className="px-2 py-2 text-left font-bold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className={cn("border-b border-border/60 hover:bg-muted/40", notReady(r) && "bg-red-500/5")}>
                    <td className="px-2 py-1.5">
                      <button onClick={() => nav({ search: (s: Search) => ({ ...s, bookingId: r.booking_id }) })} className="font-mono text-primary hover:underline">
                        {String(r.booking_id).slice(0, 6).toUpperCase()}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {fmtD(r.bookings?.scheduled_date)}
                      {notReady(r) && <div className="flex items-center gap-1 text-[0.5625rem] font-bold uppercase text-red-400"><AlertTriangle className="h-3 w-3" /> Not ready</div>}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{who(r.bookings)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{bike(r.bookings)}</td>
                    <td className="px-2 py-1.5 font-mono">{rego(r.bookings)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{svc(r.bookings)}</td>
                    <td className="px-2 py-1.5 font-semibold">{r.description}</td>
                    <td className="px-2 py-1.5 font-mono">{r.part_number}</td>
                    <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{r.qty_received}/{r.qty_required}</td>
                    <td className="px-2 py-1.5">{r.supplier}</td>
                    <td className="px-2 py-1.5 font-mono">{r.order_ref}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtD(r.ordered_at)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{fmtD(r.eta)}</td>
                    <td className="px-2 py-1.5"><StatusBadge status={r.status} /></td>
                    <td className="px-2 py-1.5 max-w-[10rem] truncate" title={r.notes ?? ""}>{r.notes}</td>
                    <td className="px-2 py-1.5"><Actions r={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <PartEditDialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)} bookingId={edit?.booking_id ?? ""} part={edit} />
      <PartEditDialog open={!!addFor} onOpenChange={(v) => !v && setAddFor(null)} bookingId={addFor ?? ""} />
    </div>
  );
}
