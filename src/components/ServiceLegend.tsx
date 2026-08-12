import { SERVICE_COLORS } from "@/lib/service-colors";

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
      <div className="text-[0.625rem] font-bold uppercase tracking-[0.25em] text-muted-foreground/70 mb-2">
        colour legend
      </div>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">
        {ITEMS.map((s) => {
          const c = SERVICE_COLORS[s.k];
          return (
            <li key={s.k} className="flex items-center gap-2 min-w-0">
              <span className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
              <span className={`text-[0.6875rem] font-medium truncate ${c.text}`}>{s.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
