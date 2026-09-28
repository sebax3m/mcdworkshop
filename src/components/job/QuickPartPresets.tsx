/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
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

type OilPreset = {
  key: string;
  /** DESCRIPTION saved on the part (house rule: name = DESCRIPTION). */
  name: string;
  /** Short label shown on the card. */
  short: string;
  /** Small line under the label. */
  sub: string;
  /** Text used to find a price in the inventory library. */
  lookup: string;
  /** Tailwind accent classes for idle / active states. */
  accent: {
    idleBorder: string;
    idleHover: string;
    active: string;
    chip: string;
    glow: string;
    panelBorder: string;
  };
};

/**
 * Oil presets, ordered by grade. 5100 first (the semi-synthetic staple),
 * then the 7100 full-synthetic range sorted by viscosity.
 * House naming rule: part_number = ITEM ("Engine Oil"), name = DESCRIPTION.
 */
const OILS: OilPreset[] = [
  {
    key: "5100-10w40",
    name: "Motul 5100 10W-40 4T",
    short: "5100 10W-40",
    sub: "Motul · 1L",
    lookup: "motul 5100",
    accent: {
      idleBorder: "border-border",
      idleHover: "hover:border-primary/50 hover:bg-primary/5",
      active: "border-primary bg-primary/10",
      chip: "bg-primary/10 text-primary",
      glow: "shadow-[0_0_22px_-8px_oklch(0.81_0.13_82/0.8)]",
      panelBorder: "border-primary/40",
    },
  },
  {
    key: "7100-10w40",
    name: "Motul 7100 10W-40 4T",
    short: "7100 10W-40",
    sub: "Motul · 1L",
    lookup: "motul 7100 10w-40",
    accent: {
      idleBorder: "border-border",
      idleHover: "hover:border-red-400/50 hover:bg-red-400/5",
      active: "border-red-400 bg-red-400/10",
      chip: "bg-red-400/10 text-red-400",
      glow: "shadow-[0_0_22px_-8px_oklch(0.63_0.2_25/0.8)]",
      panelBorder: "border-red-400/40",
    },
  },
  {
    key: "7100-15w50",
    name: "Motul 7100 15W-50 4T",
    short: "7100 15W-50",
    sub: "Motul · 1L",
    lookup: "motul 7100 15w-50",
    accent: {
      idleBorder: "border-border",
      idleHover: "hover:border-red-400/50 hover:bg-red-400/5",
      active: "border-red-400 bg-red-400/10",
      chip: "bg-red-400/10 text-red-400",
      glow: "shadow-[0_0_22px_-8px_oklch(0.63_0.2_25/0.8)]",
      panelBorder: "border-red-400/40",
    },
  },
  {
    key: "7100-20w50",
    name: "Motul 7100 20W-50 4T",
    short: "7100 20W-50",
    sub: "Motul · 1L",
    lookup: "motul 7100 20w-50",
    accent: {
      idleBorder: "border-border",
      idleHover: "hover:border-red-400/50 hover:bg-red-400/5",
      active: "border-red-400 bg-red-400/10",
      chip: "bg-red-400/10 text-red-400",
      glow: "shadow-[0_0_22px_-8px_oklch(0.63_0.2_25/0.8)]",
      panelBorder: "border-red-400/40",
    },
  },
];

const FILTER_KEY = "oil_filter";
const OIL_ITEM = "Engine Oil";
const FILTER_ITEM = "Oil Filter";

/**
 * One-tap shortcuts for the consumables that go on almost every job card:
 * the Motul oil range (choose the litres) and a HiFlo HF oil filter
 * (just type the number). Prices come from the inventory library when the
 * product is already in there.
 */
export function QuickPartPresets({ jobId, onAdded }: { jobId: string; onAdded: () => void }) {
  const { user } = useCurrentUser();
  const [active, setActive] = useState<string | null>(null);
  const [qty, setQty] = useState("1");
  const [hfNumber, setHfNumber] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const activeOil = OILS.find((o) => o.key === active) ?? null;
  const isFilter = active === FILTER_KEY;

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

  function open(key: string) {
    const oil = OILS.find((o) => o.key === key);
    setActive(key);
    setQty("1");
    setHfNumber("");
    setPrice(oil ? lookupPrice(oil.lookup) : "");
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
    if (activeOil) {
      name = `${activeOil.name} 1L`;
      item = OIL_ITEM;
    } else if (isFilter) {
      const num = hfNumber.trim().replace(/^hf/i, "");
      if (!num) return toast.error("Type the HF filter number");
      name = `HiFlo HF${num} Oil Filter`;
      item = FILTER_ITEM;
    } else {
      return;
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
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
        {OILS.map((oil) => {
          const on = active === oil.key;
          return (
            <button
              key={oil.key}
              type="button"
              onClick={() => (on ? close() : open(oil.key))}
              className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
                on
                  ? `${oil.accent.active} ${oil.accent.glow}`
                  : `${oil.accent.idleBorder} ${oil.accent.idleHover}`
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${oil.accent.chip} transition-transform group-hover:scale-105`}
                >
                  <OilBottleIcon className="h-7 w-7" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{oil.short}</div>
                  <div className="text-[0.6875rem] text-muted-foreground">{oil.sub}</div>
                </div>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => (isFilter ? close() : open(FILTER_KEY))}
          className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
            isFilter
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
        <div className={`mt-2.5 rounded-xl border bg-primary/5 p-3 ${activeOil ? activeOil.accent.panelBorder : "border-sky-400/40"}`}>
          <div className="flex flex-wrap items-end gap-2">
            {isFilter && (
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
                {activeOil ? "Litres" : "Qty"}
              </span>
              <Input
                autoFocus={!!activeOil}
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
            {activeOil
              ? `Saves as Engine Oil · ${activeOil.name} 1L`
              : "Saves as Oil Filter · HiFlo HF… Oil Filter"}
          </p>
        </div>
      )}
    </div>
  );
}

export default QuickPartPresets;
