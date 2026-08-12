import { Truck } from "lucide-react";

import { BOOK_IN_STATUS, BOOK_IN_STATUS_LEGEND } from "@/lib/book-in-status";
import { SERVICE_COLORS, SERVICE_LEGEND } from "@/lib/service-colors";

/** Primary calendar legend: operational status first, transport, then service types. */
export function BookInLegend() {
  return (
    <div className="space-y-2.5 rounded-md border border-dashed border-border/60 bg-background/40 px-3 py-2.5">
      <div>
        <div className="mb-2 text-[0.625rem] font-bold uppercase tracking-[0.25em] text-muted-foreground/70">
          book-in status
        </div>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          {BOOK_IN_STATUS_LEGEND.map((k) => {
            const s = BOOK_IN_STATUS[k];
            const Icon = s.icon;
            return (
              <li key={k} className="flex min-w-0 items-center gap-1.5">
                <Icon className={`h-3 w-3 shrink-0 ${s.text}`} />
                <span className={`truncate text-[0.6875rem] font-medium ${s.text}`}>{s.label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className="mb-1.5 text-[0.625rem] font-bold uppercase tracking-[0.25em] text-muted-foreground/70">
          pick-up / drop-off
        </div>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          <li className="flex items-center gap-1.5">
            <span className="grid h-3.5 w-3.5 place-items-center rounded bg-sky-500 text-white">
              <Truck className="h-2 w-2" />
            </span>
            <span className="text-[0.6875rem] font-medium text-sky-300">Drop-off</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="grid h-3.5 w-3.5 place-items-center rounded bg-sky-500 text-white">
              <Truck className="h-2 w-2" />
            </span>
            <span className="text-[0.6875rem] font-medium text-sky-300">Pick-up</span>
          </li>
        </ul>
      </div>

      <div>
        <div className="mb-1.5 text-[0.625rem] font-bold uppercase tracking-[0.25em] text-muted-foreground/70">
          service type
        </div>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
          {SERVICE_LEGEND.map((s) => (
            <li key={s.key} className="flex min-w-0 items-center gap-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SERVICE_COLORS[s.key].bg}`} />
              <span className="truncate text-[0.625rem] text-muted-foreground">{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
