import { useEffect, useState } from "react";
import { StickyNote, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Suggested recommendation notes — the same wording we want on the invoice. */
export const NOTE_SUGGESTIONS: string[] = [
  "Next service due in 5,000 km or 6 months, whichever comes first.",
  "Chain and sprockets showing wear — recommend replacement at next service.",
  "Tyres approaching wear indicators — recommend replacement soon.",
  "Brake pads have limited life remaining — plan replacement at next service.",
  "Recommend brake fluid change (every 2 years).",
  "Recommend coolant change (every 2 years).",
  "Front fork seals weeping — monitor and book service if leaking worsens.",
  "Battery health is low — recommend replacement before winter.",
  "Valve clearance check due at next major service interval.",
  "Recommend booking WOF before expiry date.",
];

export function readCustomerNotes(serviceData: any): string {
  const v = serviceData?.customer_notes;
  return typeof v === "string" ? v : "";
}

/**
 * Technician-facing notes for the customer. These are the exact notes shown on
 * the invoice (recommendations for the next service, follow-ups, etc.).
 */
export default function CustomerNotesSection({
  jobId,
  serviceData,
  canEdit,
  onChanged,
}: {
  jobId: string;
  serviceData: any;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const initial = readCustomerNotes(serviceData);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(initial);
  }, [initial]);

  async function save() {
    if (value === initial) return;
    setSaving(true);
    const { error } = await supabase
      .from("jobs")
      .update({ service_data: { ...(serviceData ?? {}), customer_notes: value } as any })
      .eq("id", jobId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSaved(true);
    onChanged();
  }

  function addSuggestion(text: string) {
    setValue((v) => (v.trim() ? `${v.replace(/\s+$/, "")}\n• ${text}` : `• ${text}`));
    setSaved(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4" data-print-section="customer-notes">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-service-banana" />
          <h2 className="font-display text-base font-bold uppercase tracking-wider text-service-banana bg-service-banana/10 px-2 py-0.5 rounded-md">Notes for Invoice</h2>
        </div>
        <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground no-print">
          {saving ? "Saving…" : saved ? "Saved" : "Shown on the invoice"}
        </span>
      </div>

      {canEdit ? (
        <>
          <textarea
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            onBlur={save}
            rows={4}
            placeholder="Recommendations for the customer — next service, parts to order, items to monitor…"
            className="w-full rounded-lg border border-border bg-background/50 p-3 text-sm leading-relaxed outline-none focus:border-primary resize-y print:border-border print:bg-transparent"
          />
          <div className="mt-3 print:hidden">
            <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground mb-2">
              Suggested notes
            </div>
            <div className="flex flex-wrap gap-1.5">
              {NOTE_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSuggestion(s)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2.5 py-1 text-[0.6875rem] text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  <Plus className="h-3 w-3" /> {s}
                </button>
              ))}
            </div>
            {value !== initial && (
              <Button size="sm" className="mt-3" disabled={saving} onClick={save}>
                Save notes
              </Button>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm whitespace-pre-wrap text-muted-foreground">
          {value || "No notes recorded."}
        </p>
      )}
    </div>
  );
}
