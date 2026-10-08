import { useState } from "react";
import { Input } from "@/components/ui/input";
import { usePartsCatalogSuggest, type CatalogSuggestion } from "@/lib/parts-orders";
import { cn } from "@/lib/utils";

/** Quote input that suggests previously used parts by part number / name, prioritising the same bike. */
export function QuotePartSuggestInput({
  value,
  onChange,
  onPick,
  make,
  model,
  placeholder,
  className,
  enabled = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (s: CatalogSuggestion) => void;
  make?: string | null;
  model?: string | null;
  placeholder?: string;
  className?: string;
  enabled?: boolean;
}) {
  const [focus, setFocus] = useState(false);
  const { data = [] } = usePartsCatalogSuggest(value, make, model, enabled && focus);
  const show = focus && data.length > 0;
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {show && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 max-h-72 overflow-auto rounded-md border border-border bg-popover p-1 shadow-lg print:hidden">
          {data.map((s) => {
            const sameBike =
              !!make && JSON.stringify(s.bikes ?? []).toLowerCase().includes(make.toLowerCase());
            return (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(s);
                  setFocus(false);
                }}
                className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold">{s.part_number || "—"}</span>
                  {s.last_sell != null && (
                    <span className="tabular-nums text-muted-foreground">${Number(s.last_sell).toFixed(2)}</span>
                  )}
                </div>
                <div className="truncate">{[s.item, s.description].filter(Boolean).join(" — ")}</div>
                {sameBike && (
                  <div className={cn("text-[0.625rem] uppercase tracking-wider text-primary")}>Used on this bike</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
