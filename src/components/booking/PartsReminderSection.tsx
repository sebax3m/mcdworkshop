import { useEffect, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import {
  buildSuggestions,
  mergeSuggestions,
  REMINDER_STATUSES,
  reminderKey,
  reminderStatusMeta,
  type ReminderItem,
  type ReminderStatus,
} from "@/lib/parts-reminder";

type Props = {
  serviceType: string;
  serviceTypeOther?: string;
  instructions: string;
  items: ReminderItem[];
  onChange: (items: ReminderItem[]) => void;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Parts Reminder — compact card under Instructions.
 * Suggestions come from the service type + instructions text. The workshop ticks
 * what applies and sets a status per item. Only items marked "To order" reach
 * Parts Orders; everything else stays as a reminder on the book-in.
 */
export function PartsReminderSection({ serviceType, serviceTypeOther, instructions, items, onChange }: Props) {
  const [manual, setManual] = useState("");
  // Descriptions the user explicitly removed — never re-suggested this session.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Live recommendations: refresh when service or instructions change, without
  // removing manual / user-touched / selected items (deduped by name).
  useEffect(() => {
    const suggestions = buildSuggestions(serviceType, serviceTypeOther ?? "", instructions).filter(
      (s) => !dismissed.has(norm(s.description)),
    );
    const next = mergeSuggestions(items, suggestions);
    if (
      next.length !== items.length ||
      next.some((n, i) => items[i]?.key !== n.key || items[i]?.status !== n.status || items[i]?.selected !== n.selected)
    ) {
      onChange(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType, serviceTypeOther, instructions]);

  const patch = (key: string, changes: Partial<ReminderItem>) =>
    onChange(items.map((it) => (it.key === key ? { ...it, ...changes } : it)));

  const addManual = () => {
    const desc = manual.trim();
    if (!desc) return;
    if (items.some((it) => norm(it.description) === norm(desc))) {
      setManual("");
      return;
    }
    setDismissed((prev) => {
      if (!prev.has(norm(desc))) return prev;
      const next = new Set(prev);
      next.delete(norm(desc));
      return next;
    });
    onChange([
      ...items,
      { key: reminderKey(), description: desc, status: "suggested", source: "manual", selected: true, touched: true },
    ]);
    setManual("");
  };

  const removeItem = (it: ReminderItem) => {
    // Remember the dismissal so live suggestions don't bring it back.
    setDismissed((prev) => new Set(prev).add(norm(it.description)));
    onChange(items.filter((x) => x.key !== it.key));
  };

  const selectedCount = items.filter((it) => it.selected).length;

  return (
    <div className="rounded-xl border border-orange-400/40 bg-orange-400/5 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-orange-300 shrink-0" />
        <span className="text-[0.625rem] font-bold uppercase tracking-wider text-orange-300">
          Parts reminder
        </span>
        <span className="text-[0.6875rem] text-muted-foreground">
          Suggested from service &amp; instructions
        </span>
        {selectedCount > 0 && (
          <span className="ml-auto rounded-full border border-orange-400/50 bg-orange-400/10 px-2 py-0.5 text-[0.625rem] font-bold text-orange-300">
            {selectedCount} selected
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Suggestions appear as you pick a service or write instructions. Reminders only — nothing is ordered from here.
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => {
            const st = reminderStatusMeta(it.status);
            return (
              <div
                key={it.key}
                className={
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors " +
                  (it.selected ? "border-orange-400/50 bg-background/70" : "border-border/60 bg-background/40")
                }
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-orange-500 shrink-0"
                  checked={it.selected}
                  onChange={(e) => patch(it.key, { selected: e.target.checked, touched: true })}
                  aria-label={`Include ${it.description}`}
                />
                <span
                  className={
                    "flex-1 text-sm truncate " +
                    (it.selected ? "font-semibold" : "text-muted-foreground")
                  }
                  title={it.description}
                >
                  {it.description}
                </span>
                <select
                  value={it.status}
                  onChange={(e) => patch(it.key, { status: e.target.value as ReminderStatus, touched: true })}
                  className={
                    "h-7 shrink-0 rounded-md border px-1.5 text-[0.625rem] font-bold uppercase tracking-wide bg-background focus:outline-none " +
                    st.cls
                  }
                  aria-label={`Status for ${it.description}`}
                >
                  {REMINDER_STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeItem(it)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Remove ${it.description}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addManual();
            }
          }}
          placeholder="Add item manually (e.g. Fork seals)"
          className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm focus:border-orange-400/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={addManual}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-orange-400/60 px-2.5 text-xs font-bold uppercase text-orange-300 hover:bg-orange-500/10"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      <p className="text-[0.625rem] text-muted-foreground/80">
        Reminders only — items marked <span className="font-bold text-orange-300">To order</span> are sent to Parts
        Orders when you create the book-in.
      </p>
    </div>
  );
}
