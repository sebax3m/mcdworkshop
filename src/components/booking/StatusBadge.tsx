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
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-bold uppercase tracking-wider",
        compact ? "text-[0.5rem]" : "text-[0.5625rem]",
        s.badge,
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{compact ? s.short : s.label}</span>
    </span>
  );
}
