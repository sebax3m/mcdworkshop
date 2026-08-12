import { format } from "date-fns";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

function capacityColor(booked: number, capacity: number) {
  const pct = capacity > 0 ? (booked / capacity) * 100 : booked > 0 ? 100 : 0;
  return pct >= 100 ? "#EF4444" : pct >= 75 ? "#F59E0B" : "#22C55E";
}

/** Day column header: weekday, date, capacity + thin capacity bar. */
export function CalendarDayHeader({
  day,
  booked,
  capacity,
  today,
  onClick,
  completedCount,
  hideCompleted,
  onToggleCompleted,
}: {
  day: Date;
  booked: number;
  capacity: number;
  today?: boolean;
  onClick?: () => void;
  completedCount?: number;
  hideCompleted?: boolean;
  onToggleCompleted?: () => void;
}) {
  const color = capacityColor(booked, capacity);
  const pct = capacity > 0 ? Math.min(100, (booked / capacity) * 100) : booked > 0 ? 100 : 0;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onClick}
        className="group w-full text-left"
        title="Open day view"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div
              className={cn(
                "truncate text-[0.625rem] font-semibold uppercase tracking-[0.12em]",
                today ? "text-primary" : "text-muted-foreground/70",
              )}
            >
              {format(day, "EEEE")}
            </div>
            <div className="font-display text-[1.05rem] font-bold leading-none transition-colors group-hover:text-primary">
              {format(day, "d MMM").toUpperCase()}
            </div>
          </div>
          <span
            className="shrink-0 text-[0.75rem] font-bold tabular-nums"
            style={{ color }}
          >
            {booked} / {capacity}
          </span>
        </div>
      </button>

      <div className="h-[2px] w-full overflow-hidden rounded-full bg-[color:var(--bookin-line)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      {!!completedCount && onToggleCompleted && (
        <button
          type="button"
          onClick={onToggleCompleted}
          className="inline-flex items-center gap-1 text-[0.5625rem] font-semibold uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <Check className="h-2.5 w-2.5" />
          {hideCompleted ? `Show completed (${completedCount})` : "Hide completed"}
        </button>
      )}
    </div>
  );
}
