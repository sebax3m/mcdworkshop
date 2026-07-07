const SERVICE_COLORS: Record<string, { dot: string; text: string }> = {
  basic: { dot: "bg-status-new", text: "text-status-new" },
  standard: { dot: "bg-primary", text: "text-primary" },
  full: { dot: "bg-status-assigned", text: "text-status-assigned" },
  dyno: { dot: "bg-status-dyno", text: "text-status-dyno" },
  diagnostic: { dot: "bg-status-progress", text: "text-status-progress" },
  insurance: { dot: "bg-status-insurance", text: "text-status-insurance" },
};

const ITEMS = [
  { label: "Basic", k: "basic" },
  { label: "Standard", k: "standard" },
  { label: "Full", k: "full" },
  { label: "Dyno", k: "dyno" },
  { label: "Diagnostic", k: "diagnostic" },
  { label: "Insurance", k: "insurance" },
];

export function ServiceLegend() {
  return (
    <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-3 py-2">
      <div className="text-[8px] font-bold uppercase tracking-[0.3em] text-muted-foreground/70 mb-1.5">
        Legend
      </div>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
        {ITEMS.map((s) => {
          const c = SERVICE_COLORS[s.k];
          return (
            <li key={s.k} className="flex items-center gap-1.5 min-w-0">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.dot}`} />
              <span className={`text-[9px] font-medium truncate ${c.text}`}>{s.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
