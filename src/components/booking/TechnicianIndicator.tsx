import { initialsOf } from "@/hooks/use-technician-names";
import { cn } from "@/lib/utils";

/** Compact assigned-technician chip — must not compete with the status badge. */
export function TechnicianIndicator({
  name,
  className,
  showName = true,
}: {
  name?: string | null;
  className?: string;
  showName?: boolean;
}) {
  if (!name) return null;
  return (
    <span
      title={name}
      className={cn(
        "inline-flex items-center gap-1 text-[0.5625rem] font-semibold text-muted-foreground",
        className,
      )}
    >
      <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-primary/80 text-[0.5rem] font-black text-primary-foreground">
        {initialsOf(name).charAt(0)}
      </span>
      {showName && <span className="truncate">{name.split(" ")[0]}</span>}
    </span>
  );
}
