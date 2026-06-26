import { useEffect } from "react";
import { Users, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  useTechnicians,
  useActiveTechnicianId,
  setActiveTechnicianId,
} from "@/hooks/use-active-technician";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ActiveUserSwitcher() {
  const { technicians, loading } = useTechnicians();
  const activeId = useActiveTechnicianId();
  const active = technicians.find((t) => t.id === activeId) ?? null;

  // If nothing selected yet and we have technicians, default to first.
  useEffect(() => {
    if (!loading && !activeId && technicians.length > 0) {
      setActiveTechnicianId(technicians[0].id);
    }
  }, [loading, activeId, technicians]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-2 text-sm font-medium text-foreground hover:border-foreground/30 transition-colors"
        title="Active user"
      >
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="hidden md:inline max-w-[140px] truncate">
          {active ? active.full_name : "Select user"}
        </span>
        <span className="md:hidden grid h-6 w-6 place-items-center rounded-full bg-muted text-[10px] font-semibold">
          {initials(active?.full_name ?? "?")}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Active user</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading && (
          <div className="px-2 py-3 text-xs text-muted-foreground">Loading…</div>
        )}
        {!loading && technicians.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">No staff found</div>
        )}
        {technicians.map((t) => {
          const selected = t.id === activeId;
          return (
            <DropdownMenuItem
              key={t.id}
              onSelect={() => setActiveTechnicianId(t.id)}
              className="flex items-center gap-2"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[10px] font-semibold">
                {initials(t.full_name)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm font-medium">{t.full_name}</span>
                <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t.role}
                </span>
              </span>
              <Check
                className={cn(
                  "h-4 w-4 text-primary transition-opacity",
                  selected ? "opacity-100" : "opacity-0",
                )}
              />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
