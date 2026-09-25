/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, Plus, Pencil, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  OverallBadge,
  StatusBadge,
  overallStatus,
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
    await supabase.from("bookings").update({ parts_required: true }).eq("id", bookingId);
    invalidate();
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
          {booking.parts_required ? "Flagged as needing parts — add them when known." : "No parts linked to this book-in."}
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
                  ].filter(Boolean).join(" · ")}
                </div>
                {p.notes && <div className="text-xs text-muted-foreground italic">{p.notes}</div>}
              </div>
              <StatusBadge status={p.status} />
              {p.status === "needs_ordering" && (
                <button onClick={() => setEdit({ part: { ...p, status: "ordered" } })} className="rounded-md border border-sky-500/60 px-2 h-7 text-[0.6875rem] font-bold uppercase text-sky-300 hover:bg-sky-500/15">Mark ordered</button>
              )}
              {["ordered", "partially_received", "backordered"].includes(p.status) && (
                <button onClick={() => quick(p, "arrived")} className="rounded-md border border-emerald-500/60 px-2 h-7 text-[0.6875rem] font-bold uppercase text-emerald-300 hover:bg-emerald-500/15">Arrived</button>
              )}
              <button onClick={() => setEdit({ part: p })} className="grid h-7 w-7 place-items-center rounded-md border border-border hover:border-primary/50" aria-label="Edit part">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <PartEditDialog
        open={!!edit}
        onOpenChange={(v) => !v && setEdit(null)}
        bookingId={bookingId}
        part={edit?.part}
        initialDescription={edit?.desc}
      />
    </div>
  );
}
