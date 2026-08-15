/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { GarageSuggestions, type GarageSuggestion } from "@/components/garage/GarageSuggestions";

import {
  ArrowLeft,
  Plus,
  Trash2,
  Sparkles,
  Save,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { generateCustomerReport } from "@/lib/customer-report.functions";
import { displayCustomerName } from "@/lib/display";
import { collectJobObservations, saveObservations, suggestLabourReferenceUpdates } from "@/lib/garage-learning";
import { readWorkPerformed } from "@/components/job/WorkPerformedSection";
import {
  buildInvoiceDraft,
  buildPlainReport,
  buildReportFacts,
  draftTotals,
  lineTotal,
  type DraftLine,
  type JobDraftInput,
} from "@/lib/invoice-draft";

export const Route = createFileRoute("/_authenticated/jobs_/$jobId/invoice-draft")({
  component: SmartInvoiceDraft,
  head: () => ({
    meta: [
      { title: "Smart Invoice Draft — Motorcycle Doctors" },
      {
        name: "description",
        content:
          "Review workshop-detected labour, parts and fluids before creating a customer invoice.",
      },
      { property: "og:title", content: "Smart Invoice Draft — Motorcycle Doctors" },
      {
        property: "og:description",
        content: "Review detected work and generate the customer work report before invoicing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function SmartInvoiceDraft() {
  const { jobId } = Route.useParams();
  const nav = useNavigate();
  const { user, isAdmin } = useCurrentUser();

  const job = useQuery({
    queryKey: ["draft-job", jobId],
    queryFn: async () =>
      (
        await supabase
          .from("jobs")
          .select("*, customers(*), motorcycles(*)")
          .eq("id", jobId)
          .maybeSingle()
      ).data,
  });
  const tasks = useQuery({
    queryKey: ["draft-tasks", jobId],
    queryFn: async () =>
      (await supabase.from("job_tasks").select("*").eq("job_id", jobId).order("sort_order")).data ??
      [],
  });
  const parts = useQuery({
    queryKey: ["draft-parts", jobId],
    queryFn: async () =>
      (await supabase.from("parts").select("*").eq("job_id", jobId).order("created_at")).data ?? [],
  });
  const findings = useQuery({
    queryKey: ["draft-findings", jobId],
    queryFn: async () =>
      (
        await supabase
          .from("job_inspection_findings")
          .select("*")
          .eq("job_id", jobId)
          .order("created_at")
      ).data ?? [],
  });
  const time = useQuery({
    queryKey: ["draft-time", jobId],
    queryFn: async () =>
      (await supabase.from("time_entries").select("*").eq("job_id", jobId)).data ?? [],
  });
  const notes = useQuery({
    queryKey: ["draft-notes", jobId],
    queryFn: async () =>
      (await supabase.from("job_notes").select("*").eq("job_id", jobId).order("created_at")).data ??
      [],
  });
  const saved = useQuery({
    queryKey: ["draft-saved", jobId],
    queryFn: async () =>
      (await (supabase as any).from("job_invoice_drafts").select("*").eq("job_id", jobId).maybeSingle())
        .data,
  });
  const existingInvoice = useQuery({
    queryKey: ["draft-invoice", jobId],
    queryFn: async () =>
      (
        await supabase
          .from("invoices")
          .select("id, invoice_number, status")
          .eq("job_id", jobId)
          .maybeSingle()
      ).data,
  });

  const trackedMinutes = useMemo(
    () =>
      (time.data ?? []).reduce((s: number, t: any) => {
        if (t.minutes != null) return s + Number(t.minutes);
        if (t.ended_at)
          return s + (new Date(t.ended_at).getTime() - new Date(t.started_at).getTime()) / 60000;
        return s;
      }, 0),
    [time.data],
  );

  const ready =
    job.data && tasks.data && parts.data && findings.data && time.data && notes.data && !saved.isLoading;

  const input: JobDraftInput | null = useMemo(() => {
    if (!job.data) return null;
    return {
      job: job.data as any,
      tasks: (tasks.data ?? []) as any,
      parts: (parts.data ?? []) as any,
      findings: (findings.data ?? []) as any,
      trackedMinutes,
      notes: (notes.data ?? []) as any,
      workPerformed: readWorkPerformed(((job.data as any)?.service_data ?? {}) as any),
    };
  }, [job.data, tasks.data, parts.data, findings.data, notes.data, trackedMinutes]);


  const computed = useMemo(() => (input ? buildInvoiceDraft(input) : null), [input]);

  const [lines, setLines] = useState<DraftLine[]>([]);
  const [draftNotes, setDraftNotes] = useState("");
  const [report, setReport] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState<null | "report" | "save" | "create">(null);

  useEffect(() => {
    if (hydrated || !ready || !computed) return;
    const s = saved.data as any;
    if (s && Array.isArray(s.lines) && s.lines.length) {
      setLines(s.lines as DraftLine[]);
      setDraftNotes(s.notes ?? "");
      setReport(s.customer_report ?? "");
    } else {
      setLines(computed.lines);
      setReport("");
    }
    setHydrated(true);
  }, [hydrated, ready, computed, saved.data]);

  if (!job.data || !computed) {
    return (
      <div className="p-8 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading job…
      </div>
    );
  }

  const j: any = job.data;
  const bike = j.motorcycles ?? {};
  const totals = draftTotals(lines);
  const missingPrice = lines.some((l) => l.price_required || l.unit <= 0);

  function patch(id: string, p: Partial<DraftLine>) {
    setLines((ls) =>
      ls.map((l) =>
        l.id === id
          ? { ...l, ...p, price_required: (p.unit ?? l.unit) <= 0 && l.kind !== "other" ? true : false }
          : l,
      ),
    );
  }

  function addLine() {
    setLines((ls) => [
      ...ls,
      {
        id: `manual-${Date.now()}`,
        kind: "other",
        item_code: "",
        item_name: "",
        description: "",
        quantity: 1,
        unit: 0,
        discount_pct: 0,
        source: "Added manually",
        price_required: true,
      },
    ]);
  }

  function regenerateLines() {
    if (!computed) return;
    setLines(computed.lines);
    toast.success("Draft rebuilt from job data");
  }

  async function makeReport() {
    if (!input) return;
    setBusy("report");
    const facts = buildReportFacts(input, bike);
    try {
      const res = await generateCustomerReport({ data: { facts: facts as any } });
      setReport(res.report);
      toast.success("Customer report generated");
    } catch (e: any) {
      setReport(buildPlainReport(facts));
      toast.message("Generated from job data", {
        description: e?.message ?? "AI unavailable — used plain report",
      });
    } finally {
      setBusy(null);
    }
  }

  async function saveDraft(silent = false) {
    setBusy("save");
    const payload = {
      job_id: jobId,
      lines: lines as any,
      notes: draftNotes || null,
      customer_report: report || null,
      report_generated_at: report ? new Date().toISOString() : null,
      updated_by: user?.id ?? null,
      created_by: user?.id ?? null,
    };
    const { error } = await (supabase as any)
      .from("job_invoice_drafts")
      .upsert(payload, { onConflict: "job_id" });
    if (report) {
      await supabase
        .from("jobs")
        .update({ customer_report: report, customer_report_at: new Date().toISOString() } as any)
        .eq("id", jobId);
    }
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (!silent) toast.success("Draft saved");
    saved.refetch();
    return true;
  }

  async function createInvoice() {
    if (!isAdmin) return toast.error("Only admins can create invoices");
    if (existingInvoice.data) {
      nav({ to: "/invoices/$invoiceId", params: { invoiceId: existingInvoice.data.id } });
      return;
    }
    const clean = lines.filter((l) => (l.item_name || l.description) && l.quantity > 0);
    if (!clean.length) return toast.error("Add at least one line");
    if (clean.some((l) => l.unit <= 0)) {
      return toast.error("Some lines still say PRICE REQUIRED");
    }
    setBusy("create");
    await saveDraft(true);

    const labour = clean
      .filter((l) => l.kind === "labour")
      .reduce((s, l) => s + lineTotal(l), 0);
    const rest = clean.filter((l) => l.kind !== "labour").reduce((s, l) => s + lineTotal(l), 0);
    const total = Math.round((labour + rest) * 100) / 100;
    const gst = Math.round(((total * 0.15) / 1.15) * 100) / 100;

    const year = new Date().getFullYear();
    const { data: last } = await supabase
      .from("invoices")
      .select("invoice_number")
      .like("invoice_number", `MCD-${year}-%`)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastSeq = last?.invoice_number ? Number(last.invoice_number.split("-").pop()) : 0;
    const invoice_number = `MCD-${year}-${String(Math.max(lastSeq + 1, 1000)).padStart(5, "0")}`;

    const snapshotLines = clean.map((l) => ({
      item_code: l.item_code,
      item_name: l.item_name,
      description: [l.item_name, l.description].filter(Boolean).join(" — "),
      quantity: l.quantity,
      unit: l.unit,
      discount_pct: l.discount_pct,
    }));

    const { data, error } = await supabase
      .from("invoices")
      .insert({
        job_id: jobId,
        invoice_number,
        customer_id: j.customer_id,
        motorcycle_id: j.motorcycle_id,
        labour_total: Math.round(labour * 100) / 100,
        parts_total: Math.round(rest * 100) / 100,
        gst,
        total,
        status: "draft",
        notes: [draftNotes, report].filter(Boolean).join("\n\n") || null,
        snapshot: { line_items: snapshotLines } as any,
        created_by: user?.id,
      })
      .select("id, invoice_number")
      .maybeSingle();
    setBusy(null);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    toast.success(`Invoice ${data.invoice_number} created`);

    // Phase 2 learning: observe only, never auto-change library references.
    try {
      const ctx = await collectJobObservations(jobId);
      if (ctx.completed && ctx.candidates.length) {
        toast("Save as workshop observation?", {
          description: `${ctx.candidates.length} item(s) from this completed job can be kept as Garage Library evidence.`,
          duration: 12000,
          action: {
            label: "Save",
            onClick: async () => {
              try {
                await saveObservations(ctx, data.id);
                const n = await suggestLabourReferenceUpdates(ctx.modelId);
                toast.success(
                  n > 0
                    ? `Observations saved · ${n} reference update(s) sent for Admin approval`
                    : "Workshop observations saved",
                );
              } catch (err: any) {
                toast.error(err?.message ?? "Could not save observations");
              }
            },
          },
          cancel: { label: "Ignore", onClick: () => undefined },
        });
      }
    } catch {
      /* learning is never allowed to block invoicing */
    }

    nav({ to: "/invoices/$invoiceId", params: { invoiceId: data.id } });
  }

  return (
    <div className="max-w-[1500px] mx-auto space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/jobs/$jobId" params={{ jobId }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Job card
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Smart Invoice Draft</h1>
          <p className="text-xs text-muted-foreground">
            Job #{j.job_number} · {displayCustomerName(j.customers)} ·{" "}
            {[bike.year, bike.make, bike.model].filter(Boolean).join(" ")}
            {bike.rego ? ` · ${bike.rego}` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_320px] gap-4 items-start">
        {/* LEFT — work detected from the job */}
        <section className="card-surface p-4 space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
            Work detected from job
          </h2>
          {computed.detected.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing recorded on this job yet.</p>
          )}
          <ul className="space-y-2">
            {computed.detected.map((d, i) => (
              <li key={i} className="text-sm border-b border-border/40 pb-2 last:border-0">
                <div className="font-medium">{d.label}</div>
                {d.detail && <div className="text-xs text-muted-foreground">{d.detail}</div>}
                <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground/70 mt-0.5">
                  {d.origin}
                </div>
              </li>
            ))}
          </ul>

          {computed.diffs.length > 0 && (
            <div className="pt-2">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Estimate vs actual
              </h3>
              {computed.diffs.map((d, i) => (
                <div key={i} className="text-xs space-y-0.5 mb-2">
                  <div className="font-medium">{d.label}</div>
                  <div className="text-muted-foreground">
                    Approved estimate: {d.estimateHours} h · Actual: {d.actualHours} h
                  </div>
                  <div className="font-semibold">
                    {d.actualHours > d.estimateHours ? "+" : ""}
                    {Math.round((d.actualHours - d.estimateHours) * 100) / 100} h difference
                  </div>
                </div>
              ))}
              <p className="text-[0.65rem] text-muted-foreground">
                Unauthorised extra work is not billed automatically.
              </p>
            </div>
          )}

          <GarageSuggestions
            bike={{ make: bike.make, model: bike.model, year: bike.year, motorcycleId: j.motorcycle_id }}
            onAdd={(s: GarageSuggestion) =>
              setLines((ls) => [
                ...ls,
                {
                  id: `garage-${Date.now()}`,
                  kind: s.kind === "labour" ? "labour" : "part",
                  item_code: "",
                  item_name: s.label,
                  description: s.detail,
                  quantity: s.kind === "labour" ? Number(s.hours ?? 1) : 1,
                  unit: 0,
                  discount_pct: 0,
                  source: "Garage Library suggestion",
                  price_required: true,
                },
              ])
            }
          />
        </section>


        {/* CENTRE — suggested invoice lines */}
        <section className="card-surface p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
              Suggested invoice lines
            </h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={regenerateLines}>
                Rebuild from job
              </Button>
              <Button size="sm" variant="outline" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" /> Line
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {lines.map((l) => (
              <div
                key={l.id}
                className="rounded-md border border-border/60 p-2 grid grid-cols-12 gap-2 items-center"
              >
                <div className="col-span-12 md:col-span-5 space-y-1">
                  <Input
                    value={l.item_name}
                    placeholder="Item"
                    onChange={(e) => patch(l.id, { item_name: e.target.value })}
                    className="h-8"
                  />
                  <Input
                    value={l.description}
                    placeholder="Description"
                    onChange={(e) => patch(l.id, { description: e.target.value })}
                    className="h-8 text-xs"
                  />
                  <div className="text-[0.65rem] uppercase tracking-wide text-muted-foreground/70">
                    {l.kind} · {l.source}
                  </div>
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Label className="text-[0.6rem] text-muted-foreground">Qty</Label>
                  <Input
                    type="number"
                    step="0.25"
                    value={l.quantity}
                    onChange={(e) => patch(l.id, { quantity: Number(e.target.value) })}
                    className="h-8"
                  />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <Label className="text-[0.6rem] text-muted-foreground">Unit (inc GST)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={l.unit}
                    onChange={(e) => patch(l.id, { unit: Number(e.target.value) })}
                    className={`h-8 ${l.unit <= 0 ? "border-destructive" : ""}`}
                  />
                </div>
                <div className="col-span-3 md:col-span-2 text-right">
                  {l.unit <= 0 ? (
                    <span className="text-[0.65rem] font-bold text-destructive uppercase">
                      Price required
                    </span>
                  ) : (
                    <span className="font-mono text-sm">{money(lineTotal(l))}</span>
                  )}
                </div>
                <div className="col-span-1 text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-6 text-sm pt-2 border-t border-border/60">
            <div className="text-muted-foreground">GST (incl): {money(totals.gst)}</div>
            <div className="font-bold">Total: {money(totals.total)}</div>
          </div>

          <div>
            <Label className="text-xs">Invoice notes</Label>
            <Textarea
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              rows={2}
              placeholder="Notes shown on the invoice…"
            />
          </div>

          {/* Customer work report */}
          <div className="pt-2 border-t border-border/60 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
                Customer work report
              </h2>
              <Button size="sm" variant="outline" onClick={makeReport} disabled={busy === "report"}>
                {busy === "report" ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                {report ? "Regenerate report" : "Generate report"}
              </Button>
            </div>
            <Textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              rows={12}
              placeholder="Generated from recorded job data only. Technician notes stay untouched on the job card."
              className="font-mono text-xs"
            />
            <p className="text-[0.65rem] text-muted-foreground">
              Internal technician notes are preserved separately on the job card — this report is a
              customer-facing copy.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => saveDraft()} disabled={busy === "save"}>
              <Save className="h-4 w-4 mr-1" /> Save draft
            </Button>
            <Button
              className="gold-surface font-bold"
              onClick={createInvoice}
              disabled={busy === "create" || !isAdmin}
            >
              <FileText className="h-4 w-4 mr-1" />
              {existingInvoice.data ? "Open invoice" : "Create invoice"}
            </Button>
          </div>
        </section>

        {/* RIGHT — warnings */}
        <section className="card-surface p-4 space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
            Warnings / missing information
          </h2>
          {computed.warnings.map((w, i) => (
            <div
              key={i}
              className={`text-xs flex gap-2 items-start rounded-md p-2 ${
                w.level === "error"
                  ? "bg-destructive/10 text-destructive"
                  : w.level === "warn"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-emerald-500/10 text-emerald-500"
              }`}
            >
              {w.level === "ok" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>{w.text}</span>
            </div>
          ))}
          {missingPrice && (
            <p className="text-[0.65rem] text-muted-foreground pt-1">
              Enter every missing price before creating the invoice.
            </p>
          )}
          {!isAdmin && (
            <p className="text-[0.65rem] text-muted-foreground pt-1">
              You can prepare and save this draft; an admin creates the final invoice.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
