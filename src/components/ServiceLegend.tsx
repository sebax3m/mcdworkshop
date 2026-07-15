const SERVICE_COLORS: Record<string, { dot: string; text: string }> = {
  basic: { dot: "bg-status-new", text: "text-status-new" },
  standard: { dot: "bg-primary", text: "text-primary" },
  full: { dot: "bg-status-assigned", text: "text-status-assigned" },
  dyno: { dot: "bg-status-dyno", text: "text-status-dyno" },
  diagnostic: { dot: "bg-status-progress", text: "text-status-progress" },
  insurance: { dot: "bg-status-insurance", text: "text-status-insurance" },
  postbike: { dot: "bg-cyan-400", text: "text-cyan-400" },
  other: { dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

const ITEMS = [
  { label: "Basic", k: "basic" },
  { label: "Standard", k: "standard" },
  { label: "Full", k: "full" },
  { label: "Tuning", k: "dyno" },
  { label: "Diagnostic", k: "diagnostic" },
  { label: "Insurance", k: "insurance" },
  { label: "Post Bike", k: "postbike" },
  { label: "Other", k: "other" },
];

export function ServiceLegend() {
  return (
    <div className="rounded-md border border-dashed border-border/60 bg-background/40 px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/70 mb-2">
        colour legend
      </div>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        {ITEMS.map((s) => {
          const c = SERVICE_COLORS[s.k];
          return (
            <li key={s.k} className="flex items-center gap-2 min-w-0">
              <span className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
              <span className={`text-[11px] font-medium truncate ${c.text}`}>{s.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
