/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, History, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PART_STATUSES,
  SUPPLIERS,
  SUPPLIER_SUGGESTIONS,
  useInvalidateParts,
  usePartsCatalogSuggest,
  useSupplierStats,
  type CatalogSuggestion,
} from "@/lib/parts-orders";

const inp = "w-full h-9 rounded-md border border-border bg-background px-2 text-sm";
const lbl = "text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground";


export function PartEditDialog({
  open,
  onOpenChange,
  bookingId,
  claimId,
  part,
  initialDescription,
  bikeMake,
  bikeModel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bookingId?: string | null;
  claimId?: string | null;
  part?: any | null;
  initialDescription?: string;
  bikeMake?: string | null;
  bikeModel?: string | null;
}) {
  const invalidate = useInvalidateParts();
  const [f, setF] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [usedFromHistory, setUsedFromHistory] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUsedFromHistory(null);
    setF(
      part ?? {
        description: initialDescription ?? "",
        part_number: "",
        brand: "",
        qty_required: 1,
        qty_received: 0,
        supplier: "",
        supplier_sku: "",
        supplier_url: "",
        order_ref: "",
        ordered_at: "",
        eta: "",
        received_at: "",
        status: "needs_ordering",
        notes: "",
        cost: "",
        sell_price: "",
        freight: "",
        tracking_number: "",
        tracking_url: "",
      },
    );
  }, [open, part, initialDescription]);

  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));

  const searchTerm = String(f.part_number || f.description || "");
  const suggestions = usePartsCatalogSuggest(searchTerm, bikeMake, bikeModel, open && !part?.id);
  const supplierStats = useSupplierStats(open);

  function usePrevious(s: CatalogSuggestion) {
    setF((x: any) => ({
      ...x,
      description: s.description ?? x.description,
      part_number: s.part_number ?? x.part_number,
      brand: s.brand ?? x.brand,
      supplier: s.last_supplier ?? x.supplier,
      supplier_sku: s.supplier_sku ?? x.supplier_sku,
      supplier_url: s.supplier_url ?? x.supplier_url,
      cost: s.last_cost ?? x.cost,
      sell_price: s.last_sell ?? x.sell_price,
    }));
    setUsedFromHistory(s.id);
    toast.success("Filled from previous order");
  }

  async function save() {
    if (!String(f.description ?? "").trim()) return toast.error("Enter a part description");
    setSaving(true);
    const row: any = {
      description: String(f.description).trim(),
      part_number: f.part_number?.trim() || null,
      brand: f.brand?.trim() || null,
      qty_required: Number(f.qty_required) || 1,
      qty_received: Number(f.qty_received) || 0,
      supplier: f.supplier || null,
      supplier_sku: f.supplier_sku?.trim() || null,
      supplier_url: f.supplier_url?.trim() || null,
      order_ref: f.order_ref?.trim() || null,
      ordered_at: f.ordered_at || null,
      eta: f.eta || null,
      received_at: f.received_at || null,
      status: f.status,
      notes: f.notes?.trim() || null,
      cost: f.cost === "" || f.cost == null ? null : Number(f.cost),
      sell_price: f.sell_price === "" || f.sell_price == null ? null : Number(f.sell_price),
      freight: f.freight === "" || f.freight == null ? null : Number(f.freight),
      tracking_number: f.tracking_number?.trim() || null,
      tracking_url: f.tracking_url?.trim() || null,
    };
    // Keep status consistent with quantities.
    if (row.qty_received >= row.qty_required && row.qty_received > 0) row.status = "arrived";
    else if (row.qty_received > 0 && row.status !== "backordered") row.status = "partially_received";
    if (row.status === "arrived" && !row.received_at) row.received_at = new Date().toISOString().slice(0, 10);
    if (row.status === "ordered" && !row.ordered_at) row.ordered_at = new Date().toISOString().slice(0, 10);

    const { error } = part?.id
      ? await supabase.from("booking_parts").update(row).eq("id", part.id)
      : await supabase.from("booking_parts").insert({
          ...row,
          booking_id: bookingId || null,
          claim_id: claimId || null,
          source: claimId && !bookingId ? "insurance" : "booking",
        });
    if (!error && bookingId) await supabase.from("bookings").update({ parts_required: true } as any).eq("id", bookingId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(part?.id ? "Part updated" : "Part added");
    invalidate();
    onOpenChange(false);
  }

  async function remove() {
    if (!part?.id || !confirm("Delete this part?")) return;
    const { error } = await supabase.from("booking_parts").delete().eq("id", part.id);
    if (error) return toast.error(error.message);
    invalidate();
    onOpenChange(false);
  }

  const hits = suggestions.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{part?.id ? "Edit part" : "Add part"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 space-y-1">
            <span className={lbl}>Part description</span>
            <input className={inp} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} autoFocus />
          </label>

          {hits.length > 0 && (
            <div className="col-span-2 rounded-lg border border-sky-500/40 bg-sky-500/5">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-sky-500/20">
                <History className="h-3.5 w-3.5 text-sky-300" />
                <span className="text-[0.625rem] font-bold uppercase tracking-wider text-sky-300">
                  Used before in the workshop
                </span>
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-border/40">
                {hits.map((s) => (
                  <div key={s.id} className="flex items-start gap-2 px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">
                        {s.description}
                        {s.part_number && <span className="text-muted-foreground font-normal"> · {s.part_number}</span>}
                      </div>
                      <div className="text-[0.6875rem] text-muted-foreground truncate">
                        {[
                          s.last_supplier && `Last supplier ${s.last_supplier}`,
                          s.last_cost != null && `Cost $${Number(s.last_cost).toFixed(2)}`,
                          s.last_sell != null && `Sell $${Number(s.last_sell).toFixed(2)}`,
                          `${s.times_purchased}× bought`,
                        ].filter(Boolean).join(" · ")}
                      </div>
                      {(s.bikes?.length ?? 0) > 0 && (
                        <div className="text-[0.625rem] text-muted-foreground/70 truncate">
                          Fitted to: {(s.bikes ?? []).join(", ")}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => usePrevious(s)}
                      className="shrink-0 inline-flex items-center gap-1 rounded-md border border-sky-500/60 px-2 h-7 text-[0.625rem] font-bold uppercase text-sky-300 hover:bg-sky-500/15"
                    >
                      <Sparkles className="h-3 w-3" /> Use
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {usedFromHistory && (
            <p className="col-span-2 -mt-1 text-[0.6875rem] text-sky-300">
              Filled from stored workshop history — check the price before ordering.
            </p>
          )}

          <label className="space-y-1">
            <span className={lbl}>Part number</span>
            <input className={inp} value={f.part_number ?? ""} onChange={(e) => set("part_number", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Brand</span>
            <input className={inp} value={f.brand ?? ""} onChange={(e) => set("brand", e.target.value)} placeholder="HiFlo, Motul, NGK…" />
          </label>

          <label className="space-y-1">
            <span className={lbl}>Part number</span>
            <input className={inp} value={f.part_number ?? ""} onChange={(e) => set("part_number", e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className={lbl}>Qty req.</span>
              <input type="number" min={0} className={inp} value={f.qty_required ?? 1} onChange={(e) => set("qty_required", e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className={lbl}>Qty rec.</span>
              <input type="number" min={0} className={inp} value={f.qty_received ?? 0} onChange={(e) => set("qty_received", e.target.value)} />
            </label>
          </div>
          <div className="col-span-2 space-y-1">
            <span className={lbl}>Supplier</span>
            <div className="flex flex-wrap gap-1.5">
              {SUPPLIERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set("supplier", f.supplier === s ? "" : s)}
                  className={
                    "rounded-md border px-2.5 h-8 text-xs font-semibold " +
                    (f.supplier === s ? "border-sky-500 bg-sky-500/20 text-sky-300" : "border-border hover:border-sky-500/50")
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <label className="col-span-2 space-y-1">
            <span className={lbl}>Other supplier (type any)</span>
            <input className={inp} list="supplier-suggestions" value={f.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} placeholder="eBay, Cyclespot, Partzilla, OEM dealer…" />
            <datalist id="supplier-suggestions">
              {SUPPLIER_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </label>
          <label className="space-y-1">
            <span className={lbl}>Cost (NZD)</span>
            <input type="number" step="0.01" className={inp} value={f.cost ?? ""} onChange={(e) => set("cost", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Sell price (NZD)</span>
            <input type="number" step="0.01" className={inp} value={f.sell_price ?? ""} onChange={(e) => set("sell_price", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Tracking number</span>
            <input className={inp} value={f.tracking_number ?? ""} onChange={(e) => set("tracking_number", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Tracking / product link</span>
            <input className={inp} value={f.tracking_url ?? ""} onChange={(e) => set("tracking_url", e.target.value)} placeholder="https://…" />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Order reference</span>
            <input className={inp} value={f.order_ref ?? ""} onChange={(e) => set("order_ref", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Status</span>
            <select className={inp} value={f.status ?? "needs_ordering"} onChange={(e) => set("status", e.target.value)}>
              {PART_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className={lbl}>Date ordered</span>
            <input type="date" className={inp} value={f.ordered_at ?? ""} onChange={(e) => set("ordered_at", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={lbl}>ETA</span>
            <input type="date" className={inp} value={f.eta ?? ""} onChange={(e) => set("eta", e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className={lbl}>Date received</span>
            <input type="date" className={inp} value={f.received_at ?? ""} onChange={(e) => set("received_at", e.target.value)} />
          </label>
          <label className="col-span-2 space-y-1">
            <span className={lbl}>Notes</span>
            <textarea className={inp + " h-16 py-1.5"} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </label>
        </div>
        <div className="flex items-center justify-between pt-2">
          {part?.id ? (
            <button onClick={remove} className="inline-flex items-center gap-1 text-xs text-red-400 hover:underline">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={() => onOpenChange(false)} className="rounded-md border border-border px-3 h-9 text-xs font-semibold uppercase">Cancel</button>
            <button disabled={saving} onClick={save} className="rounded-md red-surface px-4 h-9 text-xs font-bold uppercase tracking-wider disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
