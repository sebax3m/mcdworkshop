import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Gauge } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWorkshopCapacity, useSaveWorkshopCapacity } from "@/hooks/useWorkshopCapacity";

export const Route = createFileRoute("/_authenticated/settings_/capacity")({
  head: () => ({
    meta: [
      { title: "Daily book-in capacity — Motorcycle Doctors Workshop" },
      {
        name: "description",
        content: "Set how many motorcycles can be booked into the workshop on each weekday.",
      },
      { property: "og:title", content: "Daily book-in capacity — Motorcycle Doctors" },
      {
        property: "og:description",
        content: "Set how many motorcycles can be booked into the workshop on each weekday.",
      },
    ],
  }),
  component: CapacitySettings,
});

const DAYS: { weekday: number; label: string }[] = [
  { weekday: 1, label: "Monday" },
  { weekday: 2, label: "Tuesday" },
  { weekday: 3, label: "Wednesday" },
  { weekday: 4, label: "Thursday" },
  { weekday: 5, label: "Friday" },
  { weekday: 6, label: "Saturday" },
  { weekday: 0, label: "Sunday" },
];

function CapacitySettings() {
  const { isAdmin } = useCurrentUser();
  const { byWeekday, capacityFor, isLoading } = useWorkshopCapacity();
  const save = useSaveWorkshopCapacity();
  const [values, setValues] = useState<Record<number, number>>({});

  useEffect(() => {
    if (isLoading) return;
    const next: Record<number, number> = {};
    for (const d of DAYS) {
      const ref = new Date(2024, 0, 7 + d.weekday); // Jan 7 2024 = Sunday
      next[d.weekday] = byWeekday.get(d.weekday) ?? capacityFor(ref);
    }
    setValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, byWeekday.size]);

  async function onSave() {
    try {
      await save.mutateAsync(
        DAYS.map((d) => ({ weekday: d.weekday, max_bookins: Number(values[d.weekday] ?? 0) })),
      );
      toast.success("Capacity saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save capacity");
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" /> Daily book-in capacity
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          How many motorcycles the workshop normally accepts per weekday. Staff get a warning before
          exceeding it; admins can still override.
        </p>
      </div>

      <div className="card-surface p-4 space-y-2">
        {DAYS.map((d) => (
          <div key={d.weekday} className="flex items-center justify-between gap-3 py-1">
            <label htmlFor={`cap-${d.weekday}`} className="text-sm font-semibold">
              {d.label}
            </label>
            <input
              id={`cap-${d.weekday}`}
              type="number"
              min={0}
              max={50}
              disabled={!isAdmin}
              value={values[d.weekday] ?? 0}
              onChange={(e) =>
                setValues((v) => ({ ...v, [d.weekday]: Math.max(0, Number(e.target.value)) }))
              }
              className="h-9 w-24 rounded-lg border border-border bg-background px-3 text-sm tabular-nums disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      {isAdmin ? (
        <button
          onClick={onSave}
          disabled={save.isPending}
          className="rounded-lg red-surface px-4 h-10 text-sm font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {save.isPending ? "Saving…" : "Save capacity"}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">Only admins can change capacity.</p>
      )}
    </div>
  );
}
