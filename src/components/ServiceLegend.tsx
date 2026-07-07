const SERVICE_COLORS: Record<string, { bg: string; ring: string; label: string }> = {
  basic: { bg: "bg-status-new/20", ring: "ring-status-new/40", label: "text-status-new" },
  standard: { bg: "bg-primary/20", ring: "ring-primary/40", label: "text-primary" },
  full: { bg: "bg-status-assigned/20", ring: "ring-status-assigned/40", label: "text-status-assigned" },
  dyno: { bg: "bg-status-dyno/20", ring: "ring-status-dyno/40", label: "text-status-dyno" },
  diagnostic: { bg: "bg-status-progress/20", ring: "ring-status-progress/40", label: "text-status-progress" },
  insurance: { bg: "bg-status-insurance/20", ring: "ring-status-insurance/40", label: "text-status-insurance" },
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
    <div className="card-surface p-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
        Service legend
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ITEMS.map((s) => {
          const c = SERVICE_COLORS[s.k];
          return (
            <span
              key={s.k}
              className={`inline-flex items-center gap-1.5 rounded-full px-[14px] py-[6.5px] ring-1 text-[12px] font-semibold uppercase tracking-wider ${c.bg} ${c.ring} ${c.label}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
