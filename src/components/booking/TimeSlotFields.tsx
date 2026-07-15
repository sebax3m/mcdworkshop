import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import { addMinutesToTime, validateTimeRange } from "@/lib/booking-conflicts";

type Props = {
  startTime: string;
  endTime: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  /** Externally computed error (e.g. server conflict). */
  externalError?: string | null;
};

/**
 * Editable calendar slot start/end times.
 * - Defaults to a 1-hour slot when the user picks a start without an end.
 * - Estimated job hours are NOT tied to these fields — informational only.
 * - Overnight bookings are blocked by validateTimeRange.
 */
export function TimeSlotFields({
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  externalError,
}: Props) {
  useEffect(() => {
    if (startTime && !endTime) {
      onEndChange(addMinutesToTime(startTime, 60));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime]);

  const localError = validateTimeRange(startTime, endTime);
  const err = externalError || localError;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Slot start
          </Label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => onStartChange(e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Slot end</Label>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => onEndChange(e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>
      {err ? (
        <div className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground">
          The calendar slot is separate from the estimated job time.
        </div>
      )}
    </div>
  );
}
