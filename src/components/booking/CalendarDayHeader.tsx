import { format } from "date-fns";

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
    <div className="space-y-1.5">
      <button type="button" onClick={onClick} className="group w-full text-left" title="Open day view">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div
              className={cn(
                "text-[0.8rem] font-bold uppercase tracking-wider truncate",
                today ? "text-primary" : "text-muted-foreground",
              )}
            >
              {format(day, "EEEE")}
            </div>
            <div className="font-display text-lg font-bold leading-none transition-colors group-hover:text-primary">
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
          className="text-[0.55rem] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          {hideCompleted ? `Show completed (${completedCount})` : "Hide completed"}
        </button>
      )}
    </div>
  );
}
