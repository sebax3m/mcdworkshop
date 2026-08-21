import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBookingTypes } from "@/hooks/useBookingTypes";
import { changeBookingServiceType, changeBookingServiceOther } from "@/lib/service-sync";
import { serviceColor } from "@/lib/service-colors";
import { displayServiceType } from "@/lib/display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Inline editor for what a job is booked in for. When the job came from a
 * book-in it edits the booking (which syncs the job title + colour); otherwise
 * it edits the job title directly.
 */
export function ServiceTypeEditor({
  jobId,
  title,
  bookingId,
  bookingServiceType,
  bookingServiceTypeOther,
  canEdit,
  onSaved,
}: {
  jobId: string;
  title: string;
  bookingId?: string | null;
  bookingServiceType?: string | null;
  bookingServiceTypeOther?: string | null;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const { data: types = [] } = useBookingTypes(true);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(bookingServiceType ?? title);
  const [other, setOther] = useState(bookingServiceTypeOther ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(bookingServiceType ?? title);
    setOther(bookingServiceTypeOther ?? "");
  }, [bookingServiceType, bookingServiceTypeOther, title]);

  const options = Array.from(new Set([...types.map((t) => t.name), "Other"]));
  const isOther = value.toLowerCase() === "other";

  async function save() {
    setSaving(true);
    try {
      if (bookingId) {
        const res = await changeBookingServiceType({
          bookingId,
          serviceType: value,
          serviceTypeOther: isOther ? other : null,
        });
        if (res.error) throw new Error(res.error);
        if (isOther) {
          const r2 = await changeBookingServiceOther({
            bookingId,
            serviceType: value,
            serviceTypeOther: other.trim() || null,
          });
          if (r2.error) throw new Error(r2.error);
        }
      } else {
        const { error } = await supabase
          .from("jobs")
          .update({
            title: displayServiceType(value, isOther ? other.trim() || null : null),
            color: serviceColor(value).hex,
          })
          .eq("id", jobId);
        if (error) throw error;
      }
      toast.success("Service type updated");
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update service type");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-1 flex items-start gap-2">
        <h1 className="font-display text-xl sm:text-2xl font-bold break-words text-service-gold">{title}</h1>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Change service type"
            className="mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:border-primary/50 hover:text-primary print:hidden"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={options.includes(value) ? value : "__custom"}
          onChange={(e) => setValue(e.target.value === "__custom" ? title : e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          {!options.includes(value) && <option value="__custom">{value}</option>}
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5 h-9">
          <Check className="h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-9"
          onClick={() => {
            setEditing(false);
            setValue(bookingServiceType ?? title);
            setOther(bookingServiceTypeOther ?? "");
          }}
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>
      {isOther && (
        <Input
          value={other}
          onChange={(e) => setOther(e.target.value)}
          placeholder="Describe what it is booked in for"
          className="max-w-md"
        />
      )}
    </div>
  );
}
