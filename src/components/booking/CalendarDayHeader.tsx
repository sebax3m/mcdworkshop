import { format } from "date-fns";
import { Check } from "lucide-react";

import { DailyCapacity } from "@/components/booking/DailyCapacity";
import { cn } from "@/lib/utils";

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
  return (
    <div className="space-y-1">
      <button type="button" onClick={onClick} className="group w-full text-left" title="Open day view">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div
              className={cn(
                "text-[0.625rem] font-semibold uppercase tracking-[0.06em] truncate",
                today ? "text-primary" : "text-muted-foreground/70",
              )}
            >
              {format(day, "EEEE")}
            </div>
            <div className="font-display text-[1.05rem] font-bold leading-none transition-colors group-hover:text-primary">
              {format(day, "d MMM").toUpperCase()}
            </div>
          </div>
          <DailyCapacity booked={booked} capacity={capacity} className="w-20 shrink-0" hideBar />
        </div>
      </button>
      <DailyCapacity booked={booked} capacity={capacity} className="[&>div:first-child]:hidden" />
      {!!completedCount && onToggleCompleted && (
        <button
          type="button"
          onClick={onToggleCompleted}
          className="inline-flex items-center gap-1 text-[0.5625rem] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <Check className="h-2.5 w-2.5" />
          {hideCompleted ? `Show completed (${completedCount})` : "Hide completed"}
        </button>
      )}
    </div>
  );
}
