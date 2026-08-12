import { cn } from "@/lib/utils";

export type CapacityTone = "ok" | "nearly" | "full" | "over" | "closed";

export function capacityTone(booked: number, capacity: number): CapacityTone {
  if (capacity <= 0) return booked > 0 ? "over" : "closed";
  if (booked > capacity) return "over";
  if (booked === capacity) return "full";
  if (booked / capacity >= 0.75) return "nearly";
  return "ok";
}

const BAR: Record<CapacityTone, string> = {
  ok: "bg-emerald-500/80",
  nearly: "bg-amber-500",
  full: "bg-red-500",
  over: "bg-red-500",
  closed: "bg-muted-foreground/40",
};

const TEXT: Record<CapacityTone, string> = {
  ok: "text-emerald-400/80",
  nearly: "text-amber-400",
  full: "text-red-400",
  over: "text-red-400",
  closed: "text-muted-foreground",
};

/** Daily capacity: "6 / 8" + thin progress bar. Only this communicates overload. */
export function DailyCapacity({
  booked,
  capacity,
  className,
  hideBar,
}: {
  booked: number;
  capacity: number;
  className?: string;
  hideBar?: boolean;
}) {
  const tone = capacityTone(booked, capacity);
  const pct = capacity > 0 ? Math.min(100, (booked / capacity) * 100) : booked > 0 ? 100 : 0;
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center justify-end gap-1.5">
        <span className={cn("text-[0.6875rem] font-bold tabular-nums", TEXT[tone])}>
          {booked} / {capacity}
        </span>
        {(tone === "full" || tone === "over") && (
          <span className="rounded bg-red-500/15 border border-red-500/40 px-1 text-[0.5rem] font-bold uppercase tracking-wider text-red-400">
            {tone === "over" ? "Over" : "Full"}
          </span>
        )}
      </div>
      {!hideBar && (
        <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn("h-full rounded-full transition-all", BAR[tone])}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
