import { supabase } from "@/integrations/supabase/client";
import { norm, splitCsvLine, type CatalogueModel } from "@/lib/garage-catalogue";
import {
  TECH_SOURCE_TYPES,
  TECH_VERIFICATIONS,
  isSafetyCritical,
  matchModel,
  sourceRank,
  techCategory,
  toNum,
  type TechImportRow,
  type TechSpec,
} from "@/lib/garage-tech";

/**
 * Garage Library — Phase 5
 * Research assistant: missing-knowledge queue, external research STAGING,
 * curated (ChatGPT) batch import and the human review workflow.
 *
 * Hard rule enforced here: nothing researched externally ever becomes verified
 * Garage Library data without a person choosing it, and external research can
 * never overwrite manufacturer-verified or workshop-verified values without an
 * explicit conflict decision.
 */

/* ---------------- Requests ---------------- */

export const REQUEST_STATUSES = [
  { value: "open", label: "Open" },
  { value: "researching", label: "Researching" },
  { value: "answered", label: "Answered" },
  { value: "closed", label: "Closed" },
] as const;

export const PRIORITIES = [
  { value: 1, label: "High" },
  { value: 2, label: "Normal" },
  { value: 3, label: "Low" },
] as const;

export type ResearchRequest = {
  id: string;
  model_id: string;
  category: string;
  subject: string;
  field: string;
  label: string;
  note: string | null;
  priority: number;
  status: string;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function createResearchRequest(input: {
  modelId: string;
  category: string;
  subject?: string | null;
  field: string;
  label: string;
  note?: string | null;
  priority?: number;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("garage_research_requests").upsert(
    {
      model_id: input.modelId,
      category: input.category,
      subject: input.subject ?? "",
      field: input.field,
      label: input.label,
      note: input.note ?? null,
      priority: input.priority ?? 2,
      status: "open",
      requested_by: auth.user?.id ?? null,
    } as never,
    { onConflict: "model_id,category,subject,field" },
  );
  if (error) throw error;
}

export async function setRequestStatus(id: string, status: string) {
  const { data: auth } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = { status };
  if (status === "closed" || status === "answered") {
    patch["resolved_by"] = auth.user?.id ?? null;
    patch["resolved_at"] = new Date().toISOString();
  }
  const { error } = await supabase.from("garage_research_requests").update(patch as never).eq("id", id);
  if (error) throw error;
}

/* ---------------- Staged results ---------------- */

export type ResearchResult = {
  id: string;
  request_id: string | null;
  model_id: string;
  category: string;
  subject: string;
  field: string;
  value_text: string | null;
  value_num: number | null;
  unit: string | null;
  notes: string | null;
  source_type: string;
  source_name: string | null;
  source_ref: string | null;
  source_url: string | null;
  source_date: string | null;
  accessed_at: string;
  researched_by: string | null;
  origin: string;
  confidence: string;
  warnings: string[];
  model_match: string;
  conflict_spec_id: string | null;
  status: string;
  decision_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  import_batch: string | null;
  created_at: string;
};

export const RESULT_STATUSES = [
  { value: "staged", label: "Awaiting review", tone: "border-amber-500/40 bg-amber-500/10 text-amber-400" },
  { value: "accepted_unverified", label: "Accepted unverified", tone: "border-sky-500/40 bg-sky-500/10 text-sky-400" },
  { value: "verified_accepted", label: "Verified & accepted", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" },
  { value: "rejected", label: "Rejected", tone: "border-destructive/40 bg-destructive/10 text-destructive" },
  { value: "needs_more_research", label: "Needs more research", tone: "border-violet-500/40 bg-violet-500/10 text-violet-400" },
] as const;

export const resultStatus = (v: string) => RESULT_STATUSES.find((s) => s.value === v) ?? RESULT_STATUSES[0];

export const CONFIDENCE_TONE: Record<string, string> = {
  high: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  low: "border-destructive/40 bg-destructive/10 text-destructive",
};

/** Preferred sources: manufacturer / official service info / verified supplier. */
const AUTHORITATIVE = new Set(["manufacturer_document", "workshop_manual"]);
const ACCEPTABLE = new Set(["supplier"]);

export function scoreConfidence(row: {
  source_type: string;
  source_name?: string | null;
  source_ref?: string | null;
  source_date?: string | null;
  category: string;
}): { confidence: "high" | "medium" | "low"; warnings: string[] } {
  const warnings: string[] = [];
  const named = Boolean(row.source_name);
  const referenced = Boolean(row.source_ref || row.source_date);

  let confidence: "high" | "medium" | "low" = "low";
  if (AUTHORITATIVE.has(row.source_type) && named && referenced) confidence = "high";
  else if (AUTHORITATIVE.has(row.source_type) && named) confidence = "medium";
  else if (ACCEPTABLE.has(row.source_type) && named) confidence = "medium";

  if (!named) warnings.push("No named source supplied");
  if (!referenced) warnings.push("No document reference or date accessed");
  if (row.source_type === "external_research")
    warnings.push("External research — not an authoritative manufacturer source");
  if (isSafetyCritical(row.category) && confidence !== "high")
    warnings.push("SAFETY CRITICAL: do not use until verified against a manufacturer document");
  return { confidence, warnings };
}

/* ---------------- Curated / ChatGPT batch format ---------------- */

export const RESEARCH_IMPORT_COLUMNS = [
  "brand",
  "model",
  "generation",
  "year_from",
  "year_to",
  "platform",
  "category",
  "subject",
  "field",
  "value",
  "unit",
  "source_name",
  "source_reference",
  "source_url",
  "source_date",
  "verification_status",
  "notes",
] as const;

export const RESEARCH_SAMPLE = `brand,model,generation,year_from,year_to,platform,category,subject,field,value,unit,source_name,source_reference,source_url,source_date,verification_status,notes
Yamaha,MT-09,Gen 3,2021,2023,CP3,suspension,,fork_oil_qty,510,ml,MT-09 Service Manual,SM-2021-EN p.4-38,,2021-01-01,manufacturer_document,Per leg
Yamaha,MT-09,Gen 3,2021,2023,CP3,torque,Rear axle,torque,150,Nm,MT-09 Service Manual,SM-2021-EN p.2-12,,2021-01-01,manufacturer_document,
Yamaha,MT-09,Gen 3,2021,2023,CP3,valves,,intake_min,0.10,mm,ChatGPT research summary,,,2026-08-12,external_research,Needs manual confirmation`;

const clean = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};
const toInt = (v: unknown) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? Math.trunc(n) : null;
};

export type ResearchImportRow = TechImportRow & {
  platform: string | null;
  source_url: string | null;
};

function toResearchRow(raw: Record<string, unknown>): ResearchImportRow {
  const rawSource = (clean(raw["verification_status"]) ?? clean(raw["source_type"]) ?? "external_research")
    .toLowerCase()
    .replace(/\s+/g, "_");
  // Curated external data is EXTERNAL RESEARCH unless it names a real document type.
  const source_type = TECH_SOURCE_TYPES.some((s) => s.value === rawSource) ? rawSource : "external_research";
  return {
    make: String(raw["brand"] ?? raw["make"] ?? "").trim(),
    model: String(raw["model"] ?? "").trim(),
    generation: clean(raw["generation"]),
    year_from: toInt(raw["year_from"]),
    year_to: toInt(raw["year_to"]),
    category: (clean(raw["category"]) ?? "").toLowerCase().replace(/\s+/g, "_"),
    subject: clean(raw["subject"]) ?? "",
    field: (clean(raw["field"]) ?? "").toLowerCase().replace(/\s+/g, "_"),
    value: String(raw["value"] ?? "").trim(),
    unit: clean(raw["unit"]),
    notes: clean(raw["notes"]),
    source_type,
    source_name: clean(raw["source_name"]),
    source_ref: clean(raw["source_reference"]) ?? clean(raw["source_ref"]),
    source_date: clean(raw["source_date"]),
    // Staging never carries a verification — a human sets it on accept.
    verification: "unverified",
    platform: clean(raw["platform"]),
    source_url: clean(raw["source_url"]),
  };
}

export function parseResearchImport(text: string): ResearchImportRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((o) => toResearchRow(o as Record<string, unknown>));
  }
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const obj: Record<string, unknown> = {};
    header.forEach((h, i) => (obj[h] = cells[i]));
    return toResearchRow(obj);
  });
}

export type ResearchPreviewRow = {
  row: ResearchImportRow;
  ok: boolean;
  reason: string;
  modelId?: string;
  modelLabel?: string;
  existing?: TechSpec;
  conflict: boolean;
  protectedConflict: boolean;
  confidence: string;
  warnings: string[];
};

export function buildResearchPreview(
  rows: ResearchImportRow[],
  models: CatalogueModel[],
  existing: TechSpec[],
): ResearchPreviewRow[] {
  const index = new Map<string, TechSpec>();
  for (const s of existing) {
    if (s.is_alternative || s.is_archived) continue;
    index.set(`${s.model_id}|${s.category}|${norm(s.subject)}|${s.field}`, s);
  }
  return rows.map((row): ResearchPreviewRow => {
    const scored = scoreConfidence(row);
    const base = { row, conflict: false, protectedConflict: false, ...scored };
    if (!row.make || !row.model) return { ...base, ok: false, reason: "Brand and model are required" };
    if (!techCategory(row.category)) return { ...base, ok: false, reason: `Unknown category "${row.category}"` };
    if (!row.field) return { ...base, ok: false, reason: "Field is required" };
    if (!row.value) return { ...base, ok: false, reason: "Value is required" };

    const model = matchModel(row, models);
    if (!model)
      return { ...base, ok: false, reason: "No exact generation match — add the model to the catalogue first" };

    const label = `${model.make} ${model.model}${model.generation ? ` · ${model.generation}` : ""}`;
    const current = index.get(`${model.id}|${row.category}|${norm(row.subject)}|${row.field}`);
    const protectedConflict =
      !!current && ["manufacturer_verified", "workshop_verified"].includes(current.verification);
    const warnings = [...scored.warnings];
    if (current) warnings.push(`Conflicts with stored value ${current.value_text ?? current.value_num ?? ""}`);
    if (protectedConflict) warnings.push("Stored value is already verified — needs explicit conflict resolution");

    return {
      ...base,
      ok: true,
      reason: current ? "Conflicts with an existing value" : "New value",
      modelId: model.id,
      modelLabel: label,
      existing: current,
      conflict: !!current,
      protectedConflict,
      warnings,
    };
  });
}

/** Everything imported lands in STAGING — never in garage_tech_specs. */
export async function stageResearchRows(
  preview: ResearchPreviewRow[],
  origin: "chatgpt_import" | "manual_research",
  requestId?: string | null,
) {
  const { data: auth } = await supabase.auth.getUser();
  const batch = `${origin}-${new Date().toISOString()}`;
  const rows = preview
    .filter((p) => p.ok && p.modelId)
    .map((p) => ({
      request_id: requestId ?? null,
      model_id: p.modelId!,
      category: p.row.category,
      subject: p.row.subject,
      field: p.row.field,
      value_text: p.row.value,
      value_num: toNum(p.row.value),
      unit: p.row.unit,
      notes: p.row.notes,
      source_type: p.row.source_type,
      source_name: p.row.source_name,
      source_ref: p.row.source_ref,
      source_url: p.row.source_url,
      source_date: p.row.source_date,
      researched_by: auth.user?.id ?? null,
      origin,
      confidence: p.confidence,
      warnings: p.warnings,
      model_match: p.row.generation ? "exact_generation" : "year_range",
      conflict_spec_id: p.existing?.id ?? null,
      status: "staged",
      import_batch: batch,
    }));
  if (!rows.length) return { staged: 0, batch };
  const { error } = await supabase.from("garage_research_results").insert(rows as never);
  if (error) throw error;
  return { staged: rows.length, batch };
}

/* ---------------- Human review ---------------- */

export type AcceptMode = "unverified" | "verified";
export type ConflictChoice = "keep_existing" | "add_alternative" | "replace_existing";

/**
 * Move a staged result into the Garage Library.
 * Verified data can only be overwritten when the reviewer explicitly picks
 * "replace_existing"; otherwise the researched value is stored as an alternative.
 */
export async function acceptResearchResult(
  result: ResearchResult,
  mode: AcceptMode,
  opts: { conflict?: ConflictChoice; note?: string | null; verification?: string } = {},
) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;

  let existing: TechSpec | null = null;
  if (result.conflict_spec_id) {
    const { data } = await supabase
      .from("garage_tech_specs")
      .select("*")
      .eq("id", result.conflict_spec_id)
      .maybeSingle();
    existing = (data as TechSpec | null) ?? null;
  }
  const isProtected =
    !!existing && ["manufacturer_verified", "workshop_verified"].includes(existing.verification);
  const choice: ConflictChoice = opts.conflict ?? (existing ? "add_alternative" : "replace_existing");

  if (isProtected && choice === "replace_existing" && mode !== "verified") {
    throw new Error(
      "Verified data can only be replaced with a VERIFY & ACCEPT decision. Choose 'add as alternative' instead.",
    );
  }
  if (existing && choice === "keep_existing") {
    await finishResult(result.id, mode === "verified" ? "verified_accepted" : "accepted_unverified", {
      note: opts.note ?? "Existing value kept",
      userId,
    });
    return { applied: false };
  }

  const verification =
    mode === "verified"
      ? opts.verification && TECH_VERIFICATIONS.some((v) => v.value === opts.verification)
        ? opts.verification
        : "workshop_verified"
      : "unverified";

  const payload = {
    model_id: result.model_id,
    category: result.category,
    subject: result.subject,
    field: result.field,
    value_text: result.value_text,
    value_num: result.value_num,
    unit: result.unit,
    notes: [result.notes, result.source_url ? `Source URL: ${result.source_url}` : null]
      .filter(Boolean)
      .join(" · ") || null,
    source_type: result.source_type,
    source_name: result.source_name,
    source_ref: [result.source_ref, `accessed ${new Date(result.accessed_at).toISOString().slice(0, 10)}`]
      .filter(Boolean)
      .join(" · "),
    source_date: result.source_date,
    verification,
    is_alternative: choice === "add_alternative",
    review_status: mode === "verified" ? "ok" : "needs_review",
    verified_by: mode === "verified" ? userId : null,
    verified_at: mode === "verified" ? new Date().toISOString() : null,
    created_by: userId,
    updated_by: userId,
  };

  let specId: string | null = null;
  if (existing && choice === "replace_existing") {
    const { data, error } = await supabase
      .from("garage_tech_specs")
      .update(payload as never)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw error;
    specId = data.id;
  } else {
    const { data, error } = await supabase
      .from("garage_tech_specs")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw error;
    specId = data.id;
  }

  await finishResult(result.id, mode === "verified" ? "verified_accepted" : "accepted_unverified", {
    note: opts.note ?? null,
    userId,
    specId,
  });
  if (result.request_id) await setRequestStatus(result.request_id, "answered");
  return { applied: true, specId };
}

export async function rejectResearchResult(id: string, note?: string | null) {
  const { data: auth } = await supabase.auth.getUser();
  await finishResult(id, "rejected", { note: note ?? null, userId: auth.user?.id ?? null });
}

export async function needsMoreResearch(id: string, note?: string | null) {
  const { data: auth } = await supabase.auth.getUser();
  await finishResult(id, "needs_more_research", { note: note ?? null, userId: auth.user?.id ?? null });
}

async function finishResult(
  id: string,
  status: string,
  opts: { note?: string | null; userId: string | null; specId?: string | null },
) {
  const { error } = await supabase
    .from("garage_research_results")
    .update({
      status,
      decision_note: opts.note ?? null,
      reviewed_by: opts.userId,
      reviewed_at: new Date().toISOString(),
      applied_spec_id: opts.specId ?? null,
    } as never)
    .eq("id", id);
  if (error) throw error;
}

/* ---------------- Analytics ---------------- */

export async function fetchResearchAnalytics() {
  const { data, error } = await supabase.rpc("garage_research_analytics" as never);
  if (error) throw error;
  return (data ?? {}) as {
    open_requests: number;
    staged: number;
    needs_more: number;
    unverified_specs: number;
    top_missing_models: {
      model_id: string;
      make: string;
      model: string;
      generation: string | null;
      requests: number;
    }[];
    top_missing_fields: { category: string; field: string; requests: number }[];
    recently_verified: {
      id: string;
      category: string;
      field: string;
      value_text: string | null;
      value_num: number | null;
      unit: string | null;
      verification: string;
      verified_at: string;
      make: string;
      model: string;
      generation: string | null;
    }[];
  };
}

export const strongerThan = (a: { source_type: string; verification?: string }, b: TechSpec) =>
  sourceRank({ source_type: a.source_type, verification: a.verification ?? "unverified" }) < sourceRank(b);
