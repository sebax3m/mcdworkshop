import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserCog, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useTechnicians } from "@/hooks/use-active-technician";
import { initialsOf } from "@/hooks/use-technician-names";
import { cn } from "@/lib/utils";

interface Props {
  jobId: string;
  technicianId: string | null;
  canEdit?: boolean;
  onChanged?: () => void;
}

/** Technician assignment for a job card — shown above the customer details. */
export function AssignedTechnicianCard({ jobId, technicianId, canEdit = true, onChanged }: Props) {
  const { technicians, loading } = useTechnicians();
  const [saving, setSaving] = useState(false);
  const current = technicians.find((t) => t.id === technicianId) ?? null;

  async function assign(id: string | null) {
    if (id === technicianId) return;
    setSaving(true);
    const { error } = await supabase
      .from("jobs")
      .update({ technician_id: id, assigned_tech_id: id })
      .eq("id", jobId);
    if (!error) {
      await supabase.from("bookings").update({ assigned_tech_id: id }).eq("job_id", jobId);
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      id
        ? `Assigned to ${technicians.find((t) => t.id === id)?.full_name ?? "technician"}`
        : "Technician unassigned",
    );
    onChanged?.();
  }

  return (
    <div className="card-surface p-4 print:hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold",
              current ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {current ? initialsOf(current.full_name) : <UserCog className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              Assigned technician
            </div>
            <div className="truncate font-semibold">
              {current ? current.full_name : "Not assigned yet"}
            </div>
            {current && (
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                {current.role}
              </div>
            )}
          </div>
        </div>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {current ? "Change" : "Assign"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Select technician</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {loading && (
                <div className="px-2 py-3 text-xs text-muted-foreground">Loading staff…</div>
              )}
              {technicians.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onSelect={() => assign(t.id)}
                  className="flex items-center gap-2"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[0.625rem] font-semibold">
                    {initialsOf(t.full_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.full_name}</span>
                    <span className="block truncate text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                      {t.role}
                    </span>
                  </span>
                  <Check
                    className={cn(
                      "h-4 w-4 text-primary",
                      t.id === technicianId ? "opacity-100" : "opacity-0",
                    )}
                  />
                </DropdownMenuItem>
              ))}
              {technicianId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => assign(null)} className="text-destructive">
                    Unassign
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
