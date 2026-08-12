/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Phase 2 — workshop learning.
 *
 * OBSERVE -> SUGGEST -> HUMAN VERIFY -> SAVE -> REUSE.
 * Nothing in this file ever writes a Garage Library reference value directly.
 * It only records what actually happened (observations) and creates proposals
 * that an Admin must approve.
 */
import { supabase } from "@/integrations/supabase/client";
import { isFluidName } from "@/lib/invoice-draft";

export type ObservationKind = "labour" | "part" | "fluid" | "operation";

export type ObservationCandidate = {
  kind: ObservationKind;
  key_norm: string;
  label: string;
  detail?: string | null;
  value_num?: number | null;
  unit?: string | null;
};

export const PROPOSAL_CATEGORIES = [
  { value: "labour", label: "Labour" },
  { value: "parts", label: "Parts" },
  { value: "fluids", label: "Fluids" },
  { value: "technical", label: "Technical specs" },
  { value: "procedure", label: "Procedures" },
  { value: "note", label: "Notes" },
  { value: "other", label: "Other" },
] as const;

/** Safety-critical categories can never be auto-derived from job history. */
export const SAFETY_CRITICAL = new Set(["technical"]);

export const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Resolve the Garage Library model for a motorcycle (make/model/year aware). */
export async function matchModel(
  make?: string | null,
  model?: string | null,
  year?: number | null,
): Promise<string | null> {
  if (!make || !model) return null;
  const { data, error } = await (supabase as any).rpc("garage_match_model", {
    p_make: make,
    p_model: model,
    p_year: year ?? null,
  });
  if (error) return null;
  return (data as string | null) ?? null;
}

export type JobLearningContext = {
  jobId: string;
  modelId: string | null;
  motorcycleId: string | null;
  completed: boolean;
  candidates: ObservationCandidate[];
};

/**
 * Collect observation candidates from a job.
 * Only completed jobs qualify — drafts, cancelled and in-progress jobs return `completed: false`.
 */
export async function collectJobObservations(jobId: string): Promise<JobLearningContext> {
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, status, estimated_hours, motorcycle_id, motorcycles(make, model, year)")
    .eq("id", jobId)
    .maybeSingle();

  const j: any = job;
  const empty: JobLearningContext = {
    jobId,
    modelId: null,
    motorcycleId: j?.motorcycle_id ?? null,
    completed: false,
    candidates: [],
  };
  if (!j) return empty;
  if (String(j.status) !== "completed") return empty;

  const bike = j.motorcycles ?? {};
  const modelId = await matchModel(bike.make, bike.model, bike.year);

  const [{ data: parts }, { data: times }, { data: findings }] = await Promise.all([
    supabase.from("parts").select("name, quantity, supplier, on_invoice").eq("job_id", jobId),
    supabase.from("time_entries").select("minutes").eq("job_id", jobId),
    supabase
      .from("job_inspection_findings")
      .select("title, estimated_labour, status")
      .eq("job_id", jobId),
  ]);

  const tracked = (times ?? []).reduce((s: number, t: any) => s + (t.minutes ?? 0), 0);
  const candidates: ObservationCandidate[] = [];

  const mainHours = tracked > 0 ? Math.round((tracked / 60) * 100) / 100 : Number(j.estimated_hours ?? 0);
  if (j.title && mainHours > 0) {
    candidates.push({
      kind: "labour",
      key_norm: norm(j.title),
      label: j.title,
      value_num: mainHours,
      unit: "h",
      detail: tracked > 0 ? "Tracked technician time" : "Estimated hours",
    });
  }

  for (const f of (findings ?? []) as any[]) {
    // Only approved additional work counts as workshop evidence.
    if (String(f.status) !== "approved") continue;
    const hours = Number(f.estimated_labour ?? 0);
    if (!f.title || !(hours > 0)) continue;
    candidates.push({
      kind: "labour",
      key_norm: norm(f.title),
      label: f.title,
      value_num: hours,
      unit: "h",
      detail: "Approved additional work",
    });
  }

  for (const p of (parts ?? []) as any[]) {
    if (!p.name) continue;
    if (p.on_invoice === false) continue; // deleted / not billed lines are not evidence
    const fluid = isFluidName(p.name);
    candidates.push({
      kind: fluid ? "fluid" : "part",
      key_norm: norm(p.name),
      label: p.name,
      detail: p.supplier ?? null,
      value_num: fluid ? Number(p.quantity ?? 0) || null : null,
      unit: fluid ? "L" : null,
    });
  }

  // de-dupe by kind+key
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const k = `${c.kind}:${c.key_norm}`;
    if (seen.has(k) || !c.key_norm) return false;
    seen.add(k);
    return true;
  });

  return { jobId, modelId, motorcycleId: j.motorcycle_id ?? null, completed: true, candidates: unique };
}

/** Persist observations. Safe to call twice — unique index keeps one row per job/kind/key. */
export async function saveObservations(
  ctx: JobLearningContext,
  invoiceId?: string | null,
): Promise<number> {
  if (!ctx.completed || ctx.candidates.length === 0) return 0;
  const { data: auth } = await supabase.auth.getUser();
  const rows = ctx.candidates.map((c) => ({
    model_id: ctx.modelId,
    motorcycle_id: ctx.motorcycleId,
    kind: c.kind,
    key_norm: c.key_norm,
    label: c.label,
    detail: c.detail ?? null,
    value_num: c.value_num ?? null,
    unit: c.unit ?? null,
    job_id: ctx.jobId,
    invoice_id: invoiceId ?? null,
    source: invoiceId ? "confirmed_invoice" : "completed_job",
    created_by: auth.user?.id ?? null,
  }));
  const { error } = await (supabase as any)
    .from("garage_observations")
    .upsert(rows, { onConflict: "job_id,kind,key_norm", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}

/**
 * After observations are saved, look for labour references that repeated evidence
 * suggests should change, and queue an Admin proposal. Never edits the reference.
 */
export async function suggestLabourReferenceUpdates(modelId: string | null) {
  if (!modelId) return 0;
  const { data: summary } = await (supabase as any).rpc("garage_observation_summary", {
    p_model_id: modelId,
  });
  const labour: any[] = summary?.labour ?? [];
  if (!labour.length) return 0;

  const { data: refs } = await supabase
    .from("bike_library_labour")
    .select("id, task, hours")
    .eq("model_id", modelId)
    .eq("is_archived", false);

  const { data: pending } = await supabase
    .from("garage_update_proposals")
    .select("id, entity_id, field, label")
    .eq("model_id", modelId)
    .eq("status", "pending");

  const { data: auth } = await supabase.auth.getUser();
  let created = 0;

  for (const obs of labour) {
    if (Number(obs.jobs ?? 0) < 3) continue; // need repeated evidence
    const ref = (refs ?? []).find((r) => norm(r.task) === obs.key);
    if (!ref) continue;
    const current = Number(ref.hours ?? 0);
    const observed = Number(obs.avg ?? 0);
    if (!(observed > 0)) continue;
    if (current > 0 && Math.abs(observed - current) / current < 0.15) continue;
    if ((pending ?? []).some((p) => p.entity_id === ref.id && p.field === "hours")) continue;

    const { error } = await supabase.from("garage_update_proposals").insert({
      model_id: modelId,
      entity_table: "bike_library_labour",
      entity_id: ref.id,
      label: `${ref.task} — reference labour`,
      field: "hours",
      current_value: current ? String(current) : null,
      proposed_value: String(observed),
      unit: "h",
      category: "labour",
      evidence_count: Number(obs.jobs ?? 0),
      evidence: {
        jobs: obs.jobs,
        min: obs.min,
        max: obs.max,
        avg: obs.avg,
        last_at: obs.last_at,
      } as any,
      note: `Suggested from ${obs.jobs} completed jobs (${obs.min}–${obs.max} h)`,
      source: "previous_job",
      proposed_by: auth.user?.id ?? null,
    } as any);
    if (!error) created++;
  }
  return created;
}

/** One call used after invoicing / completing a job. */
export async function learnFromJob(jobId: string, invoiceId?: string | null) {
  const ctx = await collectJobObservations(jobId);
  if (!ctx.completed) return { saved: 0, proposals: 0, ctx };
  const saved = await saveObservations(ctx, invoiceId);
  let proposals = 0;
  try {
    proposals = await suggestLabourReferenceUpdates(ctx.modelId);
  } catch {
    proposals = 0;
  }
  return { saved, proposals, ctx };
}

/** Aggregated observations for a library model. */
export async function fetchObservationSummary(modelId: string) {
  const { data, error } = await (supabase as any).rpc("garage_observation_summary", {
    p_model_id: modelId,
  });
  if (error) throw error;
  return (data ?? { labour: [], parts: [], fluids: [] }) as {
    labour: any[];
    parts: any[];
    fluids: any[];
  };
}

export async function fetchModelExperience(modelId: string) {
  const { data, error } = await (supabase as any).rpc("garage_model_experience", {
    p_model_id: modelId,
  });
  if (error) throw error;
  return (data ?? { bikes: 0, jobs: 0, operations: [], last_worked: null }) as {
    bikes: number;
    jobs: number;
    operations: { title: string; count: number }[];
    last_worked: string | null;
  };
}

export async function fetchModelJobs(modelId: string, limit = 20) {
  const { data, error } = await (supabase as any).rpc("garage_model_jobs", {
    p_model_id: modelId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as any[];
}

export const evidenceLabel = (n: number) =>
  n <= 0 ? "NO WORKSHOP DATA" : `USED ON ${n} JOB${n === 1 ? "" : "S"}`;
