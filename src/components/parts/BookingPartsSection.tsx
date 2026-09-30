/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, Plus, Pencil, ExternalLink, Flag, Sparkles, X } from "lucide-react";
import { reminderStatusMeta } from "@/lib/parts-reminder";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  OverallBadge,
  StatusBadge,
  overallStatus,
  setPartsRequired,
  statusPatch,
  suggestedParts,
  useInvalidateParts,
} from "@/lib/parts-orders";

import { PartEditDialog } from "./PartEditDialog";
import { fmtD } from "./fmt";

export function BookingPartsSection({ booking }: { booking: any }) {
  const bookingId = booking.id as string;
  const invalidate = useInvalidateParts();
  const q = useQuery({
    queryKey: ["booking-parts", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_parts")
        .select("*")
        .eq("booking_id", bookingId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
  const parts = (q.data ?? []) as any[];
  // Open parts ordered for the SAME bike on another book-in (so they're never "lost").
  const motorcycleId = (booking.motorcycle_id ?? booking.motorcycles?.id ?? null) as string | null;
  const oq = useQuery({
    queryKey: ["booking-parts", "same-bike", motorcycleId, bookingId],
    enabled: !!motorcycleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_parts")
        .select("*, bookings!inner(id, scheduled_date, motorcycle_id, status)")
        .eq("bookings.motorcycle_id", motorcycleId!)
        .neq("booking_id", bookingId)
        .not("status", "in", "(cancelled)")
        .order("created_at");
      if (error) throw error;
      return (data ?? []).filter((p: any) => !["completed", "cancelled", "invoiced"].includes(p.bookings?.status));
    },
  });
  const otherParts = (oq.data ?? []) as any[];
  async function moveHere(p: any) {
    const { error } = await supabase.from("booking_parts").update({ booking_id: bookingId }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Part linked to this book-in");
    invalidate();
    q.refetch();
    oq.refetch();
  }
  // Reminder items still pending (no booking_parts row linked yet).
  const rq = useQuery({
    queryKey: ["booking-part-requirements", bookingId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_part_requirements")
        .select("id, description, status, source")
        .eq("booking_id", bookingId)
        .is("booking_part_id", null)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [edit, setEdit] = useState<{ part?: any; desc?: string } | null>(null);
  const overall = overallStatus(parts, !!booking.parts_required);
  const suggestions = suggestedParts(booking).filter(
    (s) => !parts.some((p) => p.description.toLowerCase().includes(s.toLowerCase().split(" ")[0])),
  );

  async function quick(p: any, status: any) {
    const { error } = await supabase.from("booking_parts").update(statusPatch(p, status)).eq("id", p.id);
    if (error) return toast.error(error.message);
    invalidate();
  }

  async function addSuggested(desc: string) {
    const { error } = await supabase.from("booking_parts").insert({ booking_id: bookingId, description: desc });
    if (error) return toast.error(error.message);
    await supabase.from("bookings").update({ parts_required: true } as any).eq("id", bookingId);
    invalidate();
  }

  const flagged = !!booking.parts_required;
  async function toOrder(r: any) {
    const { data, error } = await (supabase as any)
      .from("booking_parts")
      .insert({ booking_id: bookingId, description: r.description, qty_required: 1, status: "needs_ordering" })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    const { error: uErr } = await (supabase as any)
      .from("booking_part_requirements")
      .update({ status: "to_order", booking_part_id: data.id })
      .eq("id", r.id);
    if (uErr) return toast.error(uErr.message);
    invalidate();
  }
  async function dismissReminder(r: any) {
    const { error } = await (supabase as any).from("booking_part_requirements").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    invalidate();
  }

  async function toggleRequired() {
    if (flagged && parts.length > 0) {
      toast.error("Remove or cancel the listed parts first");
      return;
    }
    try {
      await setPartsRequired(bookingId, !flagged);
      toast.success(!flagged ? "Sent to Parts Orders to identify" : "Parts reminder removed");
      invalidate();
    } catch (e: any) {
      toast.error(e.message ?? "Could not update");
    }
  }

  return (
    <div className="card-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Package className="h-5 w-5 text-sky-400" />
        <h2 className="font-display text-lg font-bold">Parts</h2>
        {overall && (
          <Link to="/parts-orders" search={{ bookingId } as never} title="Open in Parts Orders">
            <OverallBadge status={overall} className="cursor-pointer hover:opacity-80" />
          </Link>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={toggleRequired}
            title="Flag this book-in so it shows in Parts Orders, even before you know the exact part"
            className={
              "inline-flex items-center gap-1 rounded-md border px-2.5 h-8 text-xs font-bold uppercase transition " +
              (flagged
                ? "border-orange-500 bg-orange-500/20 text-orange-300"
                : "border-orange-500/50 text-orange-300 hover:bg-orange-500/10")
            }
          >
            <Flag className="h-3.5 w-3.5" /> {flagged ? "Parts required" : "Order parts"}
          </button>
          <Link
            to="/parts-orders"
            search={{ bookingId } as never}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 h-8 text-xs font-semibold hover:border-primary/50"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Parts Orders
          </Link>
          <button
            onClick={() => setEdit({})}
            className="inline-flex items-center gap-1 rounded-md red-surface px-2.5 h-8 text-xs font-bold uppercase"
          >
            <Plus className="h-3.5 w-3.5" /> Add part
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Suggested:</span>
          {suggestions.map((s) => (
            <button key={s} onClick={() => addSuggested(s)} className="rounded-full border border-dashed border-orange-500/60 px-2 py-0.5 text-orange-300 hover:bg-orange-500/10">
              + {s}
            </button>
          ))}
        </div>
      )}

      {parts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {flagged
            ? "Waiting in Parts Orders to be identified — add the part here or from Parts Orders."
            : 'No parts linked to this book-in. Tap "Order parts" to flag it for Parts Orders.'}
        </p>
      ) : (

        <div className="divide-y divide-border rounded-lg border border-border">
          {parts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 p-2.5">
              <div className="flex-1 min-w-[10rem]">
                <div className="text-sm font-semibold">
                  {p.description} {p.part_number && <span className="text-muted-foreground font-normal">· {p.part_number}</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[
                    `Qty ${p.qty_received}/${p.qty_required}`,
                    p.supplier,
                    p.order_ref && `#${p.order_ref}`,
                    p.ordered_at && `Ordered ${fmtD(p.ordered_at)}`,
                    p.eta && `ETA ${fmtD(p.eta)}`,
                    p.cost != null && `Cost $${Number(p.cost).toFixed(2)}`,
                    p.sell_price != null && `Sell $${Number(p.sell_price).toFixed(2)}`,
                  ].filter(Boolean).join(" · ")}
                </div>
                {p.notes && <div className="text-xs text-muted-foreground italic">{p.notes}</div>}
              </div>
              <StatusBadge status={p.status} />
              {p.status === "needs_ordering" && (
                <button onClick={() => setEdit({ part: { ...p, status: "ordered" } })} className="rounded-md border border-sky-500/60 px-2 h-7 text-[0.6875rem] font-bold uppercase text-sky-300 hover:bg-sky-500/15">Mark ordered</button>
              )}
              {["ordered", "partially_shipped", "shipped", "ready_for_collection", "partially_received", "backordered"].includes(p.status) && (
                <button onClick={() => quick(p, "arrived")} className="rounded-md border border-emerald-500/60 px-2 h-7 text-[0.6875rem] font-bold uppercase text-emerald-300 hover:bg-emerald-500/15">Arrived</button>
              )}
              <button onClick={() => setEdit({ part: p })} className="grid h-7 w-7 place-items-center rounded-md border border-border hover:border-primary/50" aria-label="Edit part">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {otherParts.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
            Parts for this bike on another book-in
          </div>
          {otherParts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-2.5 py-1.5">
              <div className="flex-1 min-w-[10rem]">
                <div className="text-sm font-semibold">{p.description}</div>
                <div className="text-xs text-muted-foreground">
                  {[p.bookings?.scheduled_date && `Book-in ${fmtD(p.bookings.scheduled_date)}`, p.supplier, p.eta && `ETA ${fmtD(p.eta)}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              <StatusBadge status={p.status} />
              <button onClick={() => moveHere(p)} className="rounded-md border border-sky-500/60 px-2 h-7 text-[0.6875rem] font-bold uppercase text-sky-300 hover:bg-sky-500/15">
                Move here
              </button>
            </div>
          ))}
        </div>
      )}

      {(rq.data ?? []).length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-orange-300" /> Parts reminder — not ordered yet
          </div>
          {(rq.data ?? []).map((r: any) => {
            const st = reminderStatusMeta(r.status);
            return (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-2.5 py-1.5"
              >
                <span className="flex-1 text-sm font-semibold truncate">{r.description}</span>
                <span
                  className={
                    "shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider " +
                    st.cls
                  }
                >
                  {st.label}
                </span>
                <button
                  onClick={() => toOrder(r)}
                  className="shrink-0 rounded-md border border-orange-500/60 px-2 h-7 text-[0.6875rem] font-bold uppercase text-orange-300 hover:bg-orange-500/15"
                >
                  To order
                </button>
                <button
                  onClick={() => dismissReminder(r)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Remove reminder ${r.description}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <PartEditDialog

        open={!!edit}
        onOpenChange={(v) => !v && setEdit(null)}
        bookingId={bookingId}
        part={edit?.part}
        initialDescription={edit?.desc}
        bikeMake={booking.motorcycles?.make ?? null}
        bikeModel={booking.motorcycles?.model ?? null}
      />

    </div>
  );
}
