import { cn } from "@/lib/utils";
import {
  resolveBookInStatus,
  statusStyle,
  type BookInLike,
  type BookInStatusMeta,
} from "@/lib/book-in-status";

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
  return (
    <span
      title={s.label}
      style={statusStyle.badge(s.color)}
      className={cn(
        "inline-flex items-center rounded-[4px] border px-1.5 py-[2px] font-bold uppercase leading-none tracking-[0.06em]",
        compact ? "text-[0.5625rem]" : "text-[0.625rem]",
        className,
      )}
    >
      <span className="truncate">{compact ? s.short : s.label}</span>
    </span>
  );
}

/** Small rounded status icon container shown at the left of the motorcycle name. */
export function BookInStatusIcon({
  meta,
  className,
  size = "sm",
}: {
  meta: BookInStatusMeta;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = meta.icon;
  const box =
    size === "lg" ? "h-6 w-6" : size === "md" ? "h-5 w-5" : "h-[1.15rem] w-[1.15rem]";
  const icon =
    size === "lg" ? "h-3.5 w-3.5" : size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  return (
    <span
      title={meta.label}
      style={statusStyle.iconBox(meta.color)}
      className={cn("grid shrink-0 place-items-center rounded-[5px]", box, className)}
    >
      <Icon className={icon} />
    </span>
  );
}
