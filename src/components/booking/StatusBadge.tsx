import { cn } from "@/lib/utils";
import { resolveBookInStatus, type BookInLike, type BookInStatusMeta } from "@/lib/book-in-status";

/** Compact operational status badge — the dominant signal on a book-in card. */
export function StatusBadge({
  booking,
  meta,
  compact,
  className,
}: {
  booking?: BookInLike;
  meta?: BookInStatusMeta;
  compact?: boolean;
  className?: string;
}) {
  const s = meta ?? resolveBookInStatus(booking);
  const Icon = s.icon;
  return (
    <span
      title={s.label}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1 py-[1px] font-bold uppercase leading-none tracking-[0.08em]",
        compact ? "text-[0.5625rem]" : "text-[0.625rem]",
        s.badge,
        className,
      )}
    >
      <Icon className="h-[0.7rem] w-[0.7rem] shrink-0" />
      <span className="truncate">{compact ? s.short : s.label}</span>
    </span>
  );
}
