/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { matchModel } from "@/lib/garage-learning";
import type { BikeContext, TechAnswer, TechTopic } from "@/lib/mcd-tech";
import { detectTopic } from "@/lib/mcd-tech";

/* ------------------------------------------------------------------ *
 * AUTOMATIC CONTEXT
 * ------------------------------------------------------------------ */

export type McdContext = BikeContext & {
  title: string;
  subtitle: string | null;
  generation: string | null;
  engine: string | null;
  variant: string | null;
  mileage: number | null;
  modifications: string | null;
  jobNumber: number | null;
  jobLabel: string | null;
};

export const EMPTY_CONTEXT: McdContext = {
  title: "MCD TECH",
  subtitle: null,
  generation: null,
  engine: null,
  variant: null,
  mileage: null,
  modifications: null,
  jobNumber: null,
  jobLabel: null,
};

function bikeLabel(bike: any) {
  return [bike?.year, bike?.make, bike?.model].filter(Boolean).join(" ") || "Unknown motorcycle";
}

async function modelMeta(modelId: string | null) {
  if (!modelId) return null;
  const { data } = await supabase
    .from("bike_library_models")
    .select("id, make, model, variant, engine_cc, year_from, year_to")
    .eq("id", modelId)
    .maybeSingle();
  return data as any;
}

export async function buildMotorcycleContext(motorcycleId: string): Promise<McdContext> {
  const { data: bike } = await supabase
    .from("motorcycles")
    .select("id, make, model, year, mileage, modifications, ecu_info")
    .eq("id", motorcycleId)
    .maybeSingle();
  const modelId = await matchModel((bike as any)?.make, (bike as any)?.model, (bike as any)?.year ?? null);
  const meta = await modelMeta(modelId);
  return {
    ...EMPTY_CONTEXT,
    make: (bike as any)?.make ?? null,
    model: (bike as any)?.model ?? null,
    year: (bike as any)?.year ?? null,
    modelId,
    motorcycleId,
    title: bikeLabel(bike),
    subtitle: meta ? `${meta.make} ${meta.model}${meta.variant ? ` ${meta.variant}` : ""}` : null,
    generation: meta ? generationLabel(meta) : null,
    engine: meta?.engine_cc ? `${meta.engine_cc} cc` : null,
    variant: meta?.variant ?? null,
    mileage: (bike as any)?.mileage ?? null,
    modifications: (bike as any)?.modifications ?? null,
  };
}

export async function buildJobContext(jobId: string): Promise<McdContext> {
  const { data: job } = await supabase
    .from("jobs")
    .select(
      "id, job_number, title, description, service_type, status, odometer, motorcycle_id, motorcycles(id, make, model, year, mileage, modifications)",
    )
    .eq("id", jobId)
    .maybeSingle();
  const bike = (job as any)?.motorcycles ?? null;
  const modelId = await matchModel(bike?.make, bike?.model, bike?.year ?? null);
  const meta = await modelMeta(modelId);
  return {
    ...EMPTY_CONTEXT,
    make: bike?.make ?? null,
    model: bike?.model ?? null,
    year: bike?.year ?? null,
    modelId,
    motorcycleId: bike?.id ?? null,
    jobId,
    title: bikeLabel(bike),
    subtitle: `Job #${(job as any)?.job_number ?? "—"}`,
    generation: meta ? generationLabel(meta) : null,
    engine: meta?.engine_cc ? `${meta.engine_cc} cc` : null,
    variant: meta?.variant ?? null,
    mileage: (job as any)?.odometer ?? bike?.mileage ?? null,
    modifications: bike?.modifications ?? null,
    jobNumber: (job as any)?.job_number ?? null,
    jobLabel: [(job as any)?.service_type, (job as any)?.title].filter(Boolean).join(" · ") || null,
  };
}

export async function buildModelContext(modelId: string): Promise<McdContext> {
  const meta = await modelMeta(modelId);
  return {
    ...EMPTY_CONTEXT,
    make: meta?.make ?? null,
    model: meta?.model ?? null,
    year: meta?.year_from ?? null,
    modelId,
    title: [meta?.make, meta?.model, meta?.variant].filter(Boolean).join(" ") || "Garage Library model",
    subtitle: meta ? generationLabel(meta) : null,
    generation: meta ? generationLabel(meta) : null,
    engine: meta?.engine_cc ? `${meta.engine_cc} cc` : null,
    variant: meta?.variant ?? null,
  };
}

export const generationLabel = (m: { year_from: number | null; year_to: number | null }) =>
  m.year_from || m.year_to ? `${m.year_from ?? "?"}–${m.year_to ?? "?"}` : "—";

/* ------------------------------------------------------------------ *
 * SAFETY / GENERATION UNCERTAINTY
 * ------------------------------------------------------------------ */

const SAFETY_TOPICS: TechTopic[] = ["torque", "valve", "fluid"];
const SAFETY_RE =
  /torque|nm\b|valve|clearance|oil|fluid|capacity|brake|tyre|tire|pressure|timing|fastener|voltage|amp|charge/i;

export function isSafetySensitive(question: string) {
  return SAFETY_TOPICS.includes(detectTopic(question)) || SAFETY_RE.test(question);
}

export type GenerationChoice = {
  id: string;
  label: string;
  years: string;
};

/**
 * A safety-critical value is never returned from a guessed generation.
 * When several Garage Library generations exist for the make/model and the
 * year cannot pin one down, the technician must confirm first.
 */
export async function generationCandidates(ctx: McdContext): Promise<GenerationChoice[]> {
  if (!ctx.make || !ctx.model) return [];
  const { data } = await supabase
    .from("bike_library_models")
    .select("id, make, model, variant, year_from, year_to")
    .eq("is_archived", false)
    .ilike("make", ctx.make)
    .ilike("model", ctx.model);
  const rows = (data ?? []) as any[];
  if (rows.length < 2) return [];
  const inYear = ctx.year
    ? rows.filter(
        (r) => (r.year_from ?? -Infinity) <= (ctx.year as number) && (r.year_to ?? Infinity) >= (ctx.year as number),
      )
    : rows;
  if (inYear.length === 1) return [];
  return (inYear.length ? inYear : rows).map((r) => ({
    id: r.id,
    label: [r.make, r.model, r.variant].filter(Boolean).join(" "),
    years: generationLabel(r),
  }));
}

/* ------------------------------------------------------------------ *
 * CURRENT JOB SUMMARY (no AI, no invented tasks)
 * ------------------------------------------------------------------ */

export type JobStatusSummary = {
  completed: string[];
  pending: string[];
  waiting: string[];
  jobStatus: string | null;
};

export async function summariseJob(jobId: string): Promise<JobStatusSummary> {
  const [tasks, findings, job] = await Promise.all([
    supabase.from("job_tasks").select("label, is_done").eq("job_id", jobId).order("sort_order"),
    supabase.from("job_inspection_findings").select("title, status, severity").eq("job_id", jobId),
    supabase.from("jobs").select("status").eq("id", jobId).maybeSingle(),
  ]);
  const completed: string[] = [];
  const pending: string[] = [];
  const waiting: string[] = [];
  for (const t of (tasks.data ?? []) as any[]) (t.is_done ? completed : pending).push(t.label);
  for (const f of (findings.data ?? []) as any[]) {
    if (f.status === "pending_approval") waiting.push(`Customer approval — ${f.title}`);
    else if (f.status === "approved") pending.push(`${f.title} (approved, not ticked off)`);
    else if (f.status === "draft") pending.push(`${f.title} (finding, not sent)`);
  }
  return { completed, pending, waiting, jobStatus: (job.data as any)?.status ?? null };
}

/* ------------------------------------------------------------------ *
 * CONVERSATION HISTORY
 * ------------------------------------------------------------------ */

export async function ensureConversation(ctx: McdContext, existingId?: string | null) {
  if (existingId) return existingId;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("mcd_tech_conversations")
    .insert({
      user_id: uid,
      title: ctx.title,
      job_id: ctx.jobId ?? null,
      motorcycle_id: ctx.motorcycleId ?? null,
      model_id: ctx.modelId ?? null,
      context_label: [ctx.title, ctx.subtitle].filter(Boolean).join(" · "),
    })
    .select("id")
    .single();
  if (error) return null;
  return data.id as string;
}

export async function saveMessage(
  conversationId: string | null,
  role: "user" | "assistant",
  content: string,
  extra?: { payload?: unknown; answer?: TechAnswer | null },
) {
  if (!conversationId) return;
  await supabase.from("mcd_tech_messages").insert({
    conversation_id: conversationId,
    role,
    content: content.slice(0, 4000),
    payload: (extra?.payload ?? null) as any,
    answer_source: extra?.answer?.source ?? null,
    used_external_ai: extra?.answer?.usedExternalAi ?? false,
  });
  await supabase
    .from("mcd_tech_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function listConversations(limit = 20) {
  const { data } = await supabase
    .from("mcd_tech_conversations")
    .select("id, title, context_label, updated_at, job_id, motorcycle_id")
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as any[];
}

export async function loadConversation(conversationId: string) {
  const { data } = await supabase
    .from("mcd_tech_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at");
  return (data ?? []) as any[];
}
