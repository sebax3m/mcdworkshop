/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";

/** Oil bottle icon — drawn so it reads as a motorcycle oil container. */
function OilBottleIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <path
        d="M19 6h10v5l6 5c2 1.6 3 4 3 6.5V38a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V22.5c0-2.5 1-4.9 3-6.5l6-5V6Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <rect x="15" y="24" width="18" height="11" rx="2" fill="currentColor" fillOpacity="0.35" />
      <path d="M19 6h10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M34 12c3 2.6 5 5.2 5 7.4a5 5 0 1 1-10 0c0-2.2 2-4.8 5-7.4Z"
        fill="currentColor"
        fillOpacity="0.55"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Oil filter icon — canister with the classic ribbed body. */
function OilFilterIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <rect
        x="11"
        y="12"
        width="26"
        height="28"
        rx="6"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <rect
        x="15"
        y="6"
        width="18"
        height="7"
        rx="2.5"
        fill="currentColor"
        fillOpacity="0.45"
        stroke="currentColor"
        strokeWidth="2.2"
      />
      <path
        d="M13 21h22M13 27h22M13 33h22"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.8"
      />
      <circle cx="24" cy="9.5" r="1.6" fill="currentColor" />
    </svg>
  );
}

type PresetKey = "engine_oil" | "oil_filter";

const OIL_NAME = "Motul 5100 10W-40 4T";
const OIL_ITEM = "Engine Oil";
const FILTER_ITEM = "Oil Filter";

/**
 * One-tap shortcuts for the two consumables that go on almost every job card:
 * Motul 5100 10W-40 (litres) and a HiFlo HF oil filter (just type the number).
 * Follows the house naming rule: part_number = ITEM, name = DESCRIPTION.
 */
export function QuickPartPresets({ jobId, onAdded }: { jobId: string; onAdded: () => void }) {
  const { user } = useCurrentUser();
  const [active, setActive] = useState<PresetKey | null>(null);
  const [qty, setQty] = useState("1");
  const [hfNumber, setHfNumber] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  // Prices come from the inventory library when the item is already in there.
  const inventory = useQuery({
    queryKey: ["quick-preset-inventory"],
    staleTime: 120_000,
    queryFn: async () =>
      (
        await supabase
          .from("inventory_items")
          .select("id, name, sku, unit_price")
          .or("name.ilike.%motul%,name.ilike.%hf%,sku.ilike.%oil%")
          .limit(200)
      ).data ?? [],
  });

  function lookupPrice(needle: string) {
    const hit = (inventory.data ?? []).find((i: any) =>
      `${i.name ?? ""} ${i.sku ?? ""}`.toLowerCase().includes(needle.toLowerCase()),
    );
    return hit?.unit_price != null ? String(Number(hit.unit_price).toFixed(2)) : "";
  }

  function open(key: PresetKey) {
    setActive(key);
    setQty("1");
    setHfNumber("");
    setPrice(key === "engine_oil" ? lookupPrice("motul 5100") : "");
  }

  function close() {
    setActive(null);
    setHfNumber("");
    setPrice("");
    setQty("1");
  }

  async function add() {
    const q = Number(qty);
    if (!q || q <= 0) return toast.error("Quantity must be greater than 0");

    let name = "";
    let item = "";
    if (active === "engine_oil") {
      name = `${OIL_NAME} ${q === 1 ? "1L" : "1L"}`.trim();
      item = OIL_ITEM;
    } else {
      const num = hfNumber.trim().replace(/^hf/i, "");
      if (!num) return toast.error("Type the HF filter number");
      name = `HiFlo HF${num} Oil Filter`;
      item = FILTER_ITEM;
    }

    const p = price.trim() === "" ? 0 : Number(price);
    setSaving(true);
    const { error } = await supabase.from("parts").insert({
      job_id: jobId,
      name,
      part_number: item,
      quantity: q,
      cost: p,
      retail: p,
      added_by: user?.id,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${name} added`);
    close();
    onAdded();
  }

  return (
    <div className="mt-3 print:hidden">
      <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        Quick add
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => (active === "engine_oil" ? close() : open("engine_oil"))}
          className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
            active === "engine_oil"
              ? "border-primary bg-primary/10 shadow-[0_0_22px_-8px_oklch(0.81_0.13_82/0.8)]"
              : "border-border hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
              <OilBottleIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">Motul 5100 10W-40</div>
              <div className="text-[0.6875rem] text-muted-foreground">Engine oil · per litre</div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => (active === "oil_filter" ? close() : open("oil_filter"))}
          className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
            active === "oil_filter"
              ? "border-sky-400 bg-sky-400/10 shadow-[0_0_22px_-8px_oklch(0.7_0.15_230/0.8)]"
              : "border-border hover:border-sky-400/50 hover:bg-sky-400/5"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sky-400/10 text-sky-400 transition-transform group-hover:scale-105">
              <OilFilterIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">HF Oil Filter</div>
              <div className="text-[0.6875rem] text-muted-foreground">HiFlo · type the number</div>
            </div>
          </div>
        </button>
      </div>

      {active && (
        <div className="mt-2.5 rounded-xl border border-primary/40 bg-primary/5 p-3">
          <div className="flex flex-wrap items-end gap-2">
            {active === "oil_filter" && (
              <label className="space-y-1">
                <span className="block text-[0.625rem] uppercase tracking-wider text-muted-foreground font-semibold">
                  HF number
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-muted-foreground">HF</span>
                  <Input
                    autoFocus
                    inputMode="numeric"
                    value={hfNumber}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9a-zA-Z]/g, "");
                      setHfNumber(v);
                      if (v.length >= 3) setPrice((p) => p || lookupPrice(`hf${v}`));
                    }}
                    placeholder="204"
                    className="h-9 w-24 text-sm font-mono"
                  />
                </div>
              </label>
            )}
            <label className="space-y-1">
              <span className="block text-[0.625rem] uppercase tracking-wider text-muted-foreground font-semibold">
                {active === "engine_oil" ? "Litres" : "Qty"}
              </span>
              <Input
                autoFocus={active === "engine_oil"}
                type="number"
                step="0.1"
                min="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="h-9 w-24 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-[0.625rem] uppercase tracking-wider text-muted-foreground font-semibold">
                Price each
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="h-9 w-28 text-sm"
              />
            </label>
            <div className="ml-auto flex items-center gap-2">
              <Button onClick={add} disabled={saving} size="sm" className="gold-surface gap-1.5">
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Add to job
              </Button>
              <Button onClick={close} variant="ghost" size="sm">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[0.625rem] text-muted-foreground">
            {active === "engine_oil"
              ? "Saves as Engine Oil · Motul 5100 10W-40 4T 1L"
              : "Saves as Oil Filter · HiFlo HF… Oil Filter"}
          </p>
        </div>
      )}
      <div className="sr-only">
        <Plus className="h-3 w-3" />
      </div>
    </div>
  );
}

export default QuickPartPresets;
