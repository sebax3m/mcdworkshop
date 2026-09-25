/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { Package, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SUPPLIERS, suggestedParts, useInvalidateParts } from "@/lib/parts-orders";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export { SUPPLIERS };

/** Parts still to order for a booking: listed parts needing ordering + auto-suggested ones not yet listed. */
export function partsNeededFor(b: any): string[] {
  const listed = (b.booking_parts ?? []) as any[];
  const pending = listed.filter((p) => p.status === "needs_ordering").map((p) => p.description);
  const extra = suggestedParts(b).filter(
    (s) => !listed.some((p) => String(p.description).toLowerCase().includes(s.toLowerCase().split(" ")[0])),
  );
  const out = [...pending, ...extra];
  if (!out.length && b.parts_required && !listed.length) out.push("Parts (not specified)");
  return out;
}

function fmtDate(d: string) {
  return format(parseISO(d), "dd/MM/yyyy");
}

export function PartsOrderReminders() {
  const invalidateParts = useInvalidateParts();
  const today = format(new Date(), "yyyy-MM-dd");
  const until = format(addDays(new Date(), 3), "yyyy-MM-dd");

  const q = useQuery({
    queryKey: ["parts-order-reminders", today],
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, scheduled_date, service_type, service_type_other, complaints, notes, status, customers(first_name,last_name), motorcycles(year,make,model), instructions, parts_required, booking_parts(id, description, status)",
        )
        .gte("scheduled_date", today)
        .lte("scheduled_date", until)
        .order("scheduled_date");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const pending = useMemo(
    () =>
      (q.data ?? [])
        .filter((b) => !["cancelled", "deleted", "no_show"].includes(String(b.status ?? "").toLowerCase()))
        .map((b) => ({ ...b, needed: partsNeededFor(b) }))
        .filter((b) => b.needed.length > 0),
    [q.data],
  );

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<any | null>(null);
  const [supplier, setSupplier] = useState(SUPPLIERS[0]);
  const [orderNo, setOrderNo] = useState("");
  const [parts, setParts] = useState("");
  const [saving, setSaving] = useState(false);

  // Floating popup once per session per set of pending bookings.
  useEffect(() => {
    if (!pending.length) return;
    const key = `mcd:parts-reminder:${today}:${pending.map((p) => p.id).join(",")}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    setOpen(true);
  }, [pending, today]);

  function startOrder(b: any) {
    setActive(b);
    setParts(b.needed.join(", "));
    setSupplier(SUPPLIERS[0]);
    setOrderNo("");
    setOpen(true);
  }

  async function saveOrder() {
    if (!active) return;
    if (!orderNo.trim()) return toast.error("Enter the order number / confirmation");
    setSaving(true);
    const todayD = new Date().toISOString().slice(0, 10);
    const stamp = { status: "ordered", supplier, order_ref: orderNo.trim(), ordered_at: todayD };
    const existing = ((active.booking_parts ?? []) as any[]).filter((p) => p.status === "needs_ordering");
    const names = parts.split(",").map((x) => x.trim()).filter((x) => x && x !== "Parts (not specified)");
    let error: any = null;
    if (existing.length) {
      ({ error } = await supabase.from("booking_parts").update(stamp).in("id", existing.map((p) => p.id)));
    }
    const newNames = names.filter((n) => !existing.some((p) => p.description.toLowerCase() === n.toLowerCase()));
    if (!error && (newNames.length || !existing.length)) {
      ({ error } = await supabase.from("booking_parts").insert(
        (newNames.length ? newNames : ["Parts"]).map((d) => ({ booking_id: active.id, description: d, ...stamp })),
      ));
    }
    if (!error) await supabase.from("bookings").update({ parts_required: true }).eq("id", active.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Order recorded — ${supplier} #${orderNo.trim()}`);
    setActive(null);
    invalidateParts();
  }

  const label = (b: any) =>
    `${[b.customers?.first_name, b.customers?.last_name].filter(Boolean).join(" ") || "Customer"} — ${[b.motorcycles?.year, b.motorcycles?.make, b.motorcycles?.model].filter(Boolean).join(" ")}`;

  if (!pending.length) return null;

  return (
    <>
      <div className="space-y-1.5">
        {pending.map((b) => (
          <div
            key={b.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-2"
          >
            <Package className="h-4 w-4 text-sky-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[0.625rem] font-bold uppercase tracking-wider text-sky-400">
                Order parts · book-in {fmtDate(b.scheduled_date)}
              </div>
              <div className="text-sm font-semibold truncate">{label(b)}</div>
              <div className="text-xs text-muted-foreground">{b.needed.join(" · ")}</div>
            </div>
            <button
              onClick={() => startOrder(b)}
              className="inline-flex items-center gap-1.5 rounded-md border border-sky-500/60 px-3 h-8 text-xs font-bold uppercase tracking-wider text-sky-300 hover:bg-sky-500/20"
            >
              <Check className="h-3.5 w-3.5" /> Mark ordered
            </button>
          </div>
        ))}
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setActive(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-sky-400" />
              {active ? "Record parts order" : "Parts to order"}
            </DialogTitle>
            <DialogDescription>
              {active
                ? label(active)
                : "These book-ins are within 3 days and their parts haven't been ordered yet."}
            </DialogDescription>
          </DialogHeader>

          {!active ? (
            <div className="space-y-2 max-h-[60vh] overflow-auto">
              {pending.map((b) => (
                <div key={b.id} className="rounded-lg border border-border p-2.5 space-y-1">
                  <div className="text-xs font-bold text-sky-400">{fmtDate(b.scheduled_date)}</div>
                  <div className="text-sm font-semibold">{label(b)}</div>
                  <div className="text-xs text-muted-foreground">{b.needed.join(" · ")}</div>
                  <button
                    onClick={() => startOrder(b)}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-sky-500/60 px-3 h-8 text-xs font-bold uppercase tracking-wider text-sky-300 hover:bg-sky-500/20"
                  >
                    <Check className="h-3.5 w-3.5" /> Mark ordered
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parts</span>
                <input
                  value={parts}
                  onChange={(e) => setParts(e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                />
              </label>
              <div className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Supplier</span>
                <div className="flex flex-wrap gap-1.5">
                  {SUPPLIERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSupplier(s)}
                      className={
                        "rounded-md border px-2.5 h-8 text-xs font-semibold " +
                        (supplier === s
                          ? "border-sky-500 bg-sky-500/20 text-sky-300"
                          : "border-border hover:border-sky-500/50")
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Order number / confirmation
                </span>
                <input
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  autoFocus
                  className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setActive(null)}
                  className="rounded-md border border-border px-3 h-9 text-xs font-semibold uppercase"
                >
                  Back
                </button>
                <button
                  disabled={saving}
                  onClick={saveOrder}
                  className="rounded-md red-surface px-4 h-9 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save order"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
