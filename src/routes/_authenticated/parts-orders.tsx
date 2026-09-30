/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Package, Search, AlertTriangle, Pencil, X, Plus, ChevronDown, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PART_STATUSES,
  SUPPLIERS,
  StatusBadge,
  OverallBadge,
  overallStatus,
  setPartsRequired,
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
  const [moveFor, setMoveFor] = useState<any | null>(null);

  const data = useQuery({
    queryKey: ["parts-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_parts")
        .select(
          "*, insurance_claims(id, claim_number, insurer_name, customers(first_name,last_name), motorcycles(year,make,model,rego)), bookings(id, motorcycle_id, scheduled_date, service_type, service_type_other, rego, parts_required, customers(first_name,last_name), motorcycles(year,make,model,rego))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Insurance-only orders borrow customer/bike from the claim.
      return ((data ?? []) as any[]).map((r) => ({
        ...r,
        bookings: r.bookings ?? (r.insurance_claims
          ? { id: null, scheduled_date: null, customers: r.insurance_claims.customers, motorcycles: r.insurance_claims.motorcycles, service_type: "Insurance" }
          : null),
      }));
    },
  });
  // Book-ins flagged "parts required" that have no parts yet ("Parts to identify").
  const flagged = useQuery({
    queryKey: ["parts-orders", "flagged"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, scheduled_date, service_type, service_type_other, rego, customers(first_name,last_name), motorcycles(year,make,model,rego), booking_parts(id)")
        .eq("parts_required", true)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).filter((b) => !(b.booking_parts ?? []).length);
    },
  });


  const rows = data.data ?? [];
  const soon = format(addDays(new Date(), 3), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  const byBooking = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of rows) if (r.booking_id) m.set(r.booking_id, [...(m.get(r.booking_id) ?? []), r]);
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
          b.service_type, String(r.booking_id ?? "").slice(0, 8), r.insurance_claims?.claim_number, r.tracking_number,
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

  // Insurance parts are grouped into one "job card" per claim.
  const { insuranceGroups, regularRows } = useMemo(() => {
    const groups = new Map<string, any[]>();
    const regular: any[] = [];
    for (const r of filtered) {
      if (r.claim_id) groups.set(r.claim_id, [...(groups.get(r.claim_id) ?? []), r]);
      else regular.push(r);
    }
    return { insuranceGroups: [...groups.entries()], regularRows: regular };
  }, [filtered]);

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
  const addForBooking = addFor
    ? (flagged.data ?? []).find((b: any) => b.id === addFor) ??
      rows.find((r) => r.booking_id === addFor)?.bookings
    : null;


  const SourceTag = ({ r }: { r: any }) =>
    r.claim_id ? (
      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[0.5625rem] font-bold uppercase tracking-wider">
        <span className="rounded border border-violet-500/50 bg-violet-500/10 px-1 text-violet-300">Source: Insurance</span>
        <Link to="/insurance/$claimId" params={{ claimId: r.claim_id }} className="text-violet-300 underline whitespace-nowrap">
          View Insurance Job{r.insurance_claims?.claim_number ? ` · ${r.insurance_claims.claim_number}` : ""}
        </Link>
      </div>
    ) : null;

  // One collapsible "job card" per insurance claim, with its parts inside.
  const InsuranceJobCard = ({ claimId, parts }: { claimId: string; parts: any[] }) => {
    const [open, setOpen] = useState(false);
    const claim = parts[0]?.insurance_claims;
    const b = parts[0]?.bookings;
    const overall = overallStatus(parts, true);
    return (
      <div className="card-surface overflow-hidden border-violet-500/40">
        <button onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30">
          <span className="rounded border border-violet-500/50 bg-violet-500/10 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-violet-300">Insurance job</span>
          <span className="font-semibold">{claim?.claim_number ?? claimId.slice(0, 8)}</span>
          <span className="text-sm text-muted-foreground">{who(b)} · {bike(b)} {rego(b)}</span>
          {claim?.insurer_name && <span className="text-xs text-muted-foreground">· {claim.insurer_name}</span>}
          <span className="text-xs text-muted-foreground">· {parts.length} part{parts.length === 1 ? "" : "s"}</span>
          {overall && <OverallBadge status={overall} />}
          <Link
            to="/insurance/$claimId"
            params={{ claimId }}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-xs text-violet-300 underline whitespace-nowrap"
          >
            Open claim
          </Link>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="divide-y divide-border/60 border-t border-border">
            {parts.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">{r.description}</span>
                  {r.part_number && <span className="text-muted-foreground"> · {r.part_number}</span>}
                  <div className="text-xs text-muted-foreground">
                    {[`Qty ${r.qty_received}/${r.qty_required}`, r.supplier, r.order_ref && `#${r.order_ref}`, r.eta && `ETA ${fmtD(r.eta)}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <StatusBadge status={r.status} />
                <Actions r={r} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const Actions = ({ r }: { r: any }) => (
    <div className="flex gap-1 justify-end">
      {r.status === "needs_ordering" && (
        <button onClick={() => setEdit({ ...r, status: "ordered" })} className="rounded-md border border-sky-500/60 px-2 h-7 text-[0.625rem] font-bold uppercase text-sky-300 hover:bg-sky-500/15 whitespace-nowrap">Ordered</button>
      )}
      {["ordered", "partially_shipped", "shipped", "ready_for_collection", "partially_received", "backordered"].includes(r.status) && (
        <button onClick={() => quick(r, "arrived")} className="rounded-md border border-emerald-500/60 px-2 h-7 text-[0.625rem] font-bold uppercase text-emerald-300 hover:bg-emerald-500/15">Arrived</button>
      )}
      {r.booking_id && !r.claim_id && (
        <button onClick={() => setMoveFor(r)} className="grid h-7 w-7 place-items-center rounded-md border border-border hover:border-primary/50" aria-label="Move to another book-in" title="Move to another book-in">
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </button>
      )}
      <button onClick={() => setEdit(r)} className="grid h-7 w-7 place-items-center rounded-md border border-border hover:border-primary/50" aria-label="Edit">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  // One-click reassign of a part to another book-in (same bike first, then any recent).
  const MovePartDialog = ({ part }: { part: any }) => {
    const motorcycleId = part.bookings?.motorcycle_id ?? null;
    const targets = useQuery({
      queryKey: ["parts-orders", "move-targets", motorcycleId],
      queryFn: async () => {
        let qy = supabase
          .from("bookings")
          .select("id, scheduled_date, service_type, service_type_other, rego, status, customers(first_name,last_name), motorcycles(year,make,model,rego)")
          .neq("status", "cancelled")
          .order("scheduled_date", { ascending: false })
          .limit(60);
        if (motorcycleId) qy = qy.eq("motorcycle_id", motorcycleId);
        const { data, error } = await qy;
        if (error) throw error;
        return (data ?? []) as any[];
      },
    });
    const list = (targets.data ?? []).filter((b) => b.id !== part.booking_id);
    async function moveTo(bookingId: string) {
      const { error } = await supabase.from("booking_parts").update({ booking_id: bookingId }).eq("id", part.id);
      if (error) return toast.error(error.message);
      toast.success("Part moved to the selected book-in");
      setMoveFor(null);
      invalidate();
    }
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setMoveFor(null)}>
        <div className="card-surface w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-bold">Move part to another book-in</h3>
            <button onClick={() => setMoveFor(null)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{part.description}</span> is currently on the book-in of {fmtD(part.bookings?.scheduled_date)}.
            {motorcycleId ? " Showing other book-ins for the same bike." : " Showing recent book-ins."}
          </p>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {targets.isLoading ? (
              <div className="py-4 text-center text-xs text-muted-foreground">Loading book-ins…</div>
            ) : list.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground">No other book-ins found for this bike.</div>
            ) : (
              list.map((b) => (
                <button
                  key={b.id}
                  onClick={() => moveTo(b.id)}
                  className="flex w-full flex-wrap items-center gap-2 rounded-md border border-border px-2.5 py-2 text-left text-sm hover:border-primary/60 hover:bg-muted/40"
                >
                  <span className="font-semibold whitespace-nowrap">{fmtD(b.scheduled_date)}</span>
                  <span className="text-muted-foreground">{who(b)}</span>
                  <span className="text-xs text-muted-foreground">· {svc(b)}</span>
                  <span className="ml-auto font-mono text-xs">{rego(b)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

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
          <h2 className="flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-orange-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Parts to identify
          </h2>
          {(flagged.data ?? []).map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-orange-500/50 bg-orange-500/10 px-3 py-2 text-sm">
              <OverallBadge status="required" />
              <span className="font-semibold">{who(b)}</span>
              <span className="text-muted-foreground">
                {bike(b)} {rego(b) && <span className="font-mono">{rego(b)}</span>} · {fmtD(b.scheduled_date)}
              </span>
              {svc(b) && <span className="text-xs text-muted-foreground">· {svc(b)}</span>}
              <Link
                to="/bookings/$bookingId"
                params={{ bookingId: b.id }}
                className="text-xs text-orange-200 underline whitespace-nowrap"
              >
                Open book-in
              </Link>
              <div className="ml-auto flex gap-1.5">
                <button
                  onClick={async () => {
                    try {
                      await setPartsRequired(b.id, false);
                      toast.success("Parts reminder cleared");
                      invalidate();
                    } catch (e: any) {
                      toast.error(e.message ?? "Could not update");
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 h-7 text-[0.625rem] font-bold uppercase text-muted-foreground hover:border-foreground/40"
                >
                  <X className="h-3 w-3" /> No parts needed
                </button>
                <button onClick={() => setAddFor(b.id)} className="inline-flex items-center gap-1 rounded-md border border-orange-500/60 px-2 h-7 text-[0.625rem] font-bold uppercase text-orange-300">
                  <Plus className="h-3 w-3" /> Identify part
                </button>
              </div>
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
          {/* Insurance claims grouped as job cards */}
          {insuranceGroups.length > 0 && (
            <div className="space-y-2">
              {insuranceGroups.map(([claimId, parts]) => (
                <InsuranceJobCard key={claimId} claimId={claimId} parts={parts} />
              ))}
            </div>
          )}

          {/* Mobile / tablet cards */}
          <div className="space-y-2 lg:hidden">
            {regularRows.map((r) => (
              <div key={r.id} className={cn("card-surface p-3 space-y-1.5", notReady(r) && "ring-1 ring-red-500/60")}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{r.description} {r.part_number && <span className="text-muted-foreground font-normal">· {r.part_number}</span>}</div>
                    {r.booking_id ? (
                      <Link to="/bookings/$bookingId" params={{ bookingId: r.booking_id }} className="text-xs text-muted-foreground hover:underline">
                        {fmtD(r.bookings?.scheduled_date)} · {who(r.bookings)} · {bike(r.bookings)} {rego(r.bookings)}
                      </Link>
                    ) : (
                      <div className="text-xs text-muted-foreground">{who(r.bookings)} · {bike(r.bookings)} {rego(r.bookings)}</div>
                    )}
                    <SourceTag r={r} />
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
                {regularRows.map((r) => (
                  <tr key={r.id} className={cn("border-b border-border/60 hover:bg-muted/40", notReady(r) && "bg-red-500/5")}>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {r.booking_id ? (
                        <button onClick={() => nav({ search: (s: Search) => ({ ...s, bookingId: r.booking_id }) })} className="text-primary hover:underline">
                          {fmtD(r.bookings?.scheduled_date)}
                        </button>
                      ) : null}
                      <SourceTag r={r} />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {fmtD(r.bookings?.scheduled_date)}
                      {notReady(r) && <div className="flex items-center gap-1 text-[0.5625rem] font-bold uppercase text-red-400"><AlertTriangle className="h-3 w-3" /> Not ready</div>}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{who(r.bookings)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{bike(r.bookings)}</td>
                    <td className="px-2 py-1.5 font-mono">{rego(r.bookings)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{svc(r.bookings)}</td>
                    <td className="px-2 py-1.5 font-semibold">
                      {r.description}
                      {(r.tracking_number || r.tracking_url) && (
                        <div className="text-[0.625rem] font-normal">
                          {r.tracking_url ? <a href={r.tracking_url} target="_blank" rel="noreferrer" className="text-sky-300 underline">{r.tracking_number || "Tracking link"}</a> : r.tracking_number}
                        </div>
                      )}
                    </td>
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

      <PartEditDialog
        open={!!edit}
        onOpenChange={(v) => !v && setEdit(null)}
        bookingId={edit?.booking_id ?? null}
        claimId={edit?.claim_id ?? null}
        part={edit}
        bikeMake={edit?.bookings?.motorcycles?.make ?? null}
        bikeModel={edit?.bookings?.motorcycles?.model ?? null}
      />
      <PartEditDialog
        open={!!addFor}
        onOpenChange={(v) => !v && setAddFor(null)}
        bookingId={addFor ?? ""}
        bikeMake={addForBooking?.motorcycles?.make ?? null}
        bikeModel={addForBooking?.motorcycles?.model ?? null}
      />

    </div>
  );
}
