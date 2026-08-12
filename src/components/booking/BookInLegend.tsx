import { Truck } from "lucide-react";

import { BOOK_IN_STATUS, BOOK_IN_STATUS_LEGEND } from "@/lib/book-in-status";

/** Compact calendar legend: operational status + transport only. */
export function BookInLegend() {
  return (
    <div className="space-y-2 rounded-[12px] border border-border/40 bg-background/30 px-2.5 py-2">
      <div>
        <div className="mb-1.5 text-[0.5625rem] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
          status
        </div>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
          {BOOK_IN_STATUS_LEGEND.map((k) => {
            const s = BOOK_IN_STATUS[k];
            return (
              <li key={k} className="flex min-w-0 items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                <span className="truncate text-[0.625rem] text-muted-foreground">{s.label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <div className="mb-1 text-[0.5625rem] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
          transport
        </div>
        <div className="flex items-center gap-1.5">
          <span className="grid h-3.5 w-3.5 place-items-center rounded bg-sky-500 text-white">
            <Truck className="h-2 w-2" />
          </span>
          <span className="text-[0.625rem] text-muted-foreground">Pick-up / Drop-off</span>
        </div>
      </div>
    </div>
  );
}
