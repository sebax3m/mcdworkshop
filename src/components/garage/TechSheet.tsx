import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Printer, FileText, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TechVerificationBadge, useTechSpecs } from "@/components/garage/TechSpecsTab";
import { createResearchRequest } from "@/lib/garage-research";
import {
  QUICK_SHEET_SECTIONS,
  groupSpecs,
  missingKnowledge,
  specValue,
  techFieldLabel,
  techSourceLabel,
  type TechSpec,
} from "@/lib/garage-tech";


const cardCls = "rounded-lg border border-border bg-card";

const line = (s: TechSpec) => `${s.subject ? `${s.subject} — ` : ""}${techFieldLabel(s.category, s.field)}`;

/* ---------------- Quick cards ---------------- */

const QUICK_CARDS: { label: string; category: string; fields?: string[] }[] = [
  { label: "Engine oil", category: "engine_oil", fields: ["oil_viscosity", "oil_capacity_filter_l", "oil_standard"] },
  { label: "Filter", category: "filters" },
  { label: "Spark plug", category: "spark_plugs", fields: ["manufacturer", "part_number", "gap_mm"] },
  { label: "Valves", category: "valves", fields: ["intake_min", "intake_max", "exhaust_min", "exhaust_max", "condition"] },
  { label: "Tyres", category: "tyres", fields: ["front_size", "rear_size", "front_pressure", "rear_pressure"] },
  { label: "Common torques", category: "torque" },
  { label: "Service interval", category: "service_intervals" },
  { label: "Common jobs", category: "labour" },
];

export function TechQuickCards({ modelId }: { modelId: string }) {
  const { data: specs = [] } = useTechSpecs(modelId);
  const grouped = useMemo(() => groupSpecs(specs), [specs]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {QUICK_CARDS.map((c) => {
        const rows = (grouped.get(c.category) ?? [])
          .filter((s) => !s.is_alternative)
          .filter((s) => (c.fields ? c.fields.includes(s.field) : true))
          .slice(0, 6);
        return (
          <div key={c.label} className={`${cardCls} p-3`}>
            <div className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">{c.label}</div>
            {rows.length === 0 ? (
              <div className="mt-2 text-xs text-muted-foreground">No data</div>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {rows.map((s) => (
                  <li key={s.id} className="text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-muted-foreground">{line(s)}</span>
                      <span className="font-mono font-medium">{specValue(s)}</span>
                    </div>
                    <TechVerificationBadge value={s.verification} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Missing knowledge ---------------- */

export function MissingKnowledgeCard({ modelId }: { modelId: string }) {
  const { data: specs = [] } = useTechSpecs(modelId);
  const qc = useQueryClient();
  const items = useMemo(() => missingKnowledge(specs), [specs]);
  const missing = items.filter((i) => !i.present);

  async function research(list: typeof items) {
    try {
      for (const i of list) {
        await createResearchRequest({
          modelId,
          category: i.category,
          subject: i.subject ?? "",
          field: i.field,
          label: i.label,
        });
      }
      qc.invalidateQueries({ queryKey: ["research-requests"] });
      qc.invalidateQueries({ queryKey: ["research-analytics"] });
      toast.success(`${list.length} item(s) added to the research queue`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className={`${cardCls} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">Missing knowledge</div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {items.length - missing.length}/{items.length} covered
          </span>
          {missing.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => research(missing)}>
              <Search className="mr-1 h-3.5 w-3.5" /> Research all
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <Link to="/garage-library/research">Queue</Link>
          </Button>
        </div>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {items.map((i) => (
          <li key={`${i.category}-${i.subject ?? ""}-${i.field}`} className="flex items-center gap-2 text-xs">
            {i.present ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            )}
            <span className={i.present ? "text-foreground" : "text-amber-400"}>{i.label}</span>
            {!i.present && (
              <button
                type="button"
                onClick={() => research([i])}
                className="ml-auto font-mono text-[0.6rem] uppercase tracking-widest text-primary hover:underline"
              >
                Research
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}


/* ---------------- Quick tech sheet ---------------- */

export function QuickTechSheetButton({ modelId, title }: { modelId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const { data: specs = [] } = useTechSpecs(modelId);
  const grouped = useMemo(() => groupSpecs(specs), [specs]);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FileText className="mr-1 h-3.5 w-3.5" /> Quick tech sheet
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base uppercase tracking-wide">{title} · Quick tech sheet</DialogTitle>
          </DialogHeader>
          <div id="quick-tech-sheet" className="space-y-4">
            {QUICK_SHEET_SECTIONS.map((sec) => {
              const rows = sec.categories.flatMap((c) => grouped.get(c) ?? []);
              if (rows.length === 0) return null;
              return (
                <section key={sec.key}>
                  <h3 className="border-b border-border pb-1 text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">{sec.label}</h3>
                  <ul className="mt-2 space-y-1">
                    {rows.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                          {line(s)}
                          {s.is_alternative ? " (alternative)" : ""}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono font-medium">{specValue(s)}</span>
                          <TechVerificationBadge value={s.verification} />
                          <span className="text-[0.6rem] text-muted-foreground">{techSourceLabel(s.source_type)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            {specs.length === 0 ? <p className="text-sm text-muted-foreground">No technical data stored for this model yet.</p> : null}
          </div>
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1 h-3.5 w-3.5" /> Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
