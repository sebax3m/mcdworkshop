import { supabase } from "@/integrations/supabase/client";
import { searchDocuments, askExternalAi } from "@/lib/mcd-tech.functions";

/**
 * MCD TECH retrieval engine (client orchestration).
 *
 * Priority cascade — cheapest and most trustworthy first:
 *   1. Structured verified Garage Library data (+ bike-specific knowledge)
 *   2. Linked technical documents (exact make/model/generation only)
 *   3. Workshop history / observations
 *   4. External AI (last fallback, always flagged UNVERIFIED)
 *
 * Source priority for a technical specification, highest first:
 *   manufacturer verified document > workshop verified data >
 *   verified supplier document > workshop observation > external AI
 * Exact model/generation matching is mandatory: a manufacturer spec for the
 * wrong generation never outranks an exact workshop-verified value.
 */

export type AnswerSource = "structured" | "document" | "history" | "external_ai" | "none";

export type SpecRow = { label: string; value: string; note?: string | null };

export type SourceBadge = {
  kind: AnswerSource;
  label: string;
  detail?: string | null;
  documentId?: string | null;
  reference?: string | null;
  verification?: string | null;
  version?: string | null;
};

export type DocSection = {
  chunk_id: string;
  document_id: string;
  title: string;
  manufacturer: string;
  doc_model: string | null;
  generation: string | null;
  year_from: number | null;
  year_to: number | null;
  doc_type: string;
  version: string | null;
  verification: string;
  heading: string | null;
  page_from: number | null;
  page_to: number | null;
  content: string;
  score: number;
};

export type Conflict = {
  label: string;
  left: { source: string; value: string };
  right: { source: string; value: string };
};

export type TechAnswer = {
  question: string;
  topic: TechTopic;
  source: AnswerSource;
  heading: string;
  specs: SpecRow[];
  sections: DocSection[];
  badges: SourceBadge[];
  conflicts: Conflict[];
  aiText?: string | null;
  usedExternalAi: boolean;
  cacheHit: boolean;
  queryId?: string | null;
};

export type BikeContext = {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  modelId?: string | null;
  motorcycleId?: string | null;
  jobId?: string | null;
};

export const normQuestion = (q: string) =>
  q.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export type TechTopic =
  | "valve"
  | "fluid"
  | "torque"
  | "part"
  | "labour"
  | "procedure"
  | "general";

const TOPIC_RULES: Array<{ topic: TechTopic; re: RegExp }> = [
  { topic: "valve", re: /valve|clearance|shim|tappet/ },
  { topic: "fluid", re: /oil|coolant|fluid|capacity|brake fluid|fork oil|litre|liter/ },
  { topic: "torque", re: /torque|nm|tightening|tighten|bolt|nut|axle|caliper/ },
  { topic: "part", re: /part number|filter|plug|pad|gasket|seal|tyre|tire|sprocket|chain|battery/ },
  { topic: "labour", re: /how long|hours|labour|labor|time to|book time/ },
  { topic: "procedure", re: /remove|removal|replace|replacement|install|procedure|adjust|bleed|checklist|how to/ },
];

export function detectTopic(question: string): TechTopic {
  const q = normQuestion(question);
  for (const r of TOPIC_RULES) if (r.re.test(q)) return r.topic;
  return "general";
}

/** Small in-memory cache so repeated internal questions never re-hit the gateway. */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; answer: TechAnswer }>();
const cacheKey = (q: string, bike: BikeContext) =>
  `${normQuestion(q)}|${bike.modelId ?? ""}|${bike.make ?? ""}|${bike.model ?? ""}|${bike.year ?? ""}`;

export function clearTechCache() {
  cache.clear();
}

const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

const numbersIn = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(",", ".")));

/* ------------------------------------------------------------------ *
 * 1. STRUCTURED VERIFIED DATA
 * ------------------------------------------------------------------ */

async function structuredLookup(topic: TechTopic, question: string, bike: BikeContext) {
  const specs: SpecRow[] = [];
  const badges: SourceBadge[] = [];
  if (!bike.modelId) return { specs, badges };

  const verifiedBadge = (verification: string, detail: string): SourceBadge => ({
    kind: "structured",
    label: verification === "manufacturer_verified" ? "Manufacturer verified" : "Workshop verified",
    detail,
    verification,
  });

  if (topic === "valve" || topic === "general") {
    const { data } = await supabase
      .from("garage_valve_specs")
      .select("*")
      .eq("model_id", bike.modelId)
      .eq("is_archived", false)
      .limit(1);
    const v = data?.[0];
    if (v) {
      specs.push(
        { label: "Intake", value: `${fmt(v.intake_min)} – ${fmt(v.intake_max)} ${v.unit ?? "mm"}` },
        { label: "Exhaust", value: `${fmt(v.exhaust_min)} – ${fmt(v.exhaust_max)} ${v.unit ?? "mm"}` },
      );
      if (v.inspection_interval_km)
        specs.push({ label: "Inspection interval", value: `${v.inspection_interval_km} km` });
      if (v.measurement_notes) specs.push({ label: "Measurement", value: v.measurement_notes });
      badges.push(verifiedBadge(v.verification, "Garage Library valve specification"));
    }
  }

  if (topic === "fluid" || topic === "general") {
    const { data } = await supabase
      .from("garage_fluid_specs")
      .select("*")
      .eq("model_id", bike.modelId)
      .eq("is_archived", false)
      .order("sort_order");
    for (const f of data ?? []) {
      const qty = f.qty_with_filter ?? f.qty_without_filter;
      specs.push({
        label: f.fluid_type,
        value: [f.spec, qty ? `${qty} ${f.unit ?? "L"}` : null].filter(Boolean).join(" · ") || "—",
        note: f.preferred_product ?? f.filter_part_number,
      });
      badges.push(verifiedBadge(f.verification, `Garage Library fluid · ${f.fluid_type}`));
    }
  }

  if (topic === "torque" || topic === "general") {
    const { data } = await supabase
      .from("bike_library_torque")
      .select("*")
      .eq("model_id", bike.modelId)
      .eq("is_archived", false)
      .order("sort_order");
    const q = normQuestion(question);
    const words = q.split(" ").filter((w) => w.length > 3);
    const matches = (data ?? []).filter((t) =>
      topic === "general" ? false : words.some((w) => normQuestion(t.fastener).includes(w)),
    );
    for (const t of matches.length ? matches : topic === "torque" ? (data ?? []).slice(0, 6) : []) {
      specs.push({
        label: t.fastener,
        value: `${fmt(t.torque_nm)} ${t.unit ?? "Nm"}`,
        note: t.notes,
      });
      badges.push(verifiedBadge(t.verification, `Garage Library torque · ${t.fastener}`));
    }
  }

  if (topic === "part") {
    const { data } = await supabase
      .from("bike_library_parts")
      .select("*")
      .eq("model_id", bike.modelId)
      .eq("is_archived", false)
      .order("sort_order")
      .limit(12);
    for (const p of data ?? []) {
      specs.push({
        label: p.name,
        value: [p.brand, p.part_number].filter(Boolean).join(" ") || "—",
        note: p.supplier,
      });
      badges.push(verifiedBadge(p.verification, `Garage Library part · ${p.name}`));
    }
  }

  if (topic === "labour" || topic === "procedure") {
    const { data } = await supabase
      .from("bike_library_labour")
      .select("*")
      .eq("model_id", bike.modelId)
      .eq("is_archived", false)
      .order("sort_order");
    const words = normQuestion(question).split(" ").filter((w) => w.length > 3);
    for (const l of (data ?? []).filter((l) =>
      words.some((w) => normQuestion(l.task).includes(w)),
    )) {
      specs.push({
        label: l.task,
        value: l.hours ? `${l.hours} h` : "—",
        note: [l.parts_required, l.special_tools].filter(Boolean).join(" · ") || null,
      });
      badges.push(verifiedBadge(l.verification, `Garage Library labour · ${l.task}`));
    }
  }

  // Bike-specific knowledge always wins for THIS motorcycle.
  if (bike.motorcycleId) {
    const { data } = await supabase
      .from("motorcycle_knowledge")
      .select("*")
      .eq("motorcycle_id", bike.motorcycleId);
    for (const k of data ?? []) {
      specs.unshift({
        label: `${k.label} (this bike)`,
        value: [k.value, k.unit].filter(Boolean).join(" ") || "—",
        note: k.notes,
      });
      badges.unshift({
        kind: "structured",
        label: "This motorcycle",
        detail: `Bike-specific ${k.category}`,
        verification: "workshop_verified",
      });
    }
  }

  return { specs, badges };
}

/* ------------------------------------------------------------------ *
 * 3. WORKSHOP HISTORY
 * ------------------------------------------------------------------ */

async function historyLookup(topic: TechTopic, question: string, bike: BikeContext) {
  const specs: SpecRow[] = [];
  if (!bike.modelId) return specs;
  const { data } = await supabase.rpc("garage_observation_summary", { p_model_id: bike.modelId });
  const summary = (data ?? {}) as Record<string, Array<Record<string, unknown>>>;
  const bucket =
    topic === "fluid" ? "fluids" : topic === "part" ? "parts" : topic === "labour" ? "labour" : null;
  const words = normQuestion(question).split(" ").filter((w) => w.length > 3);
  const rows = bucket ? (summary[bucket] ?? []) : [...(summary["labour"] ?? []), ...(summary["parts"] ?? [])];
  for (const r of rows) {
    const label = String(r["label"] ?? "");
    if (words.length && !words.some((w) => normQuestion(label).includes(w))) continue;
    const avg = r["avg_value"];
    specs.push({
      label,
      value: avg ? `${Number(avg).toFixed(2)} (workshop average)` : "used previously",
      note: r["evidence"] ? `${r["evidence"]} job(s)` : null,
    });
  }
  return specs.slice(0, 6);
}

/* ------------------------------------------------------------------ *
 * CONFLICT DETECTION
 * ------------------------------------------------------------------ */

export function detectConflicts(specs: SpecRow[], sections: DocSection[]): Conflict[] {
  const out: Conflict[] = [];
  for (const s of specs) {
    const structuredNums = numbersIn(s.value);
    if (!structuredNums.length) continue;
    const key = normQuestion(s.label).split(" ").filter((w) => w.length > 3);
    if (!key.length) continue;
    for (const sec of sections) {
      const content = normQuestion(sec.content);
      if (!key.every((w) => content.includes(w))) continue;
      // Look for a figure near the matched component in the manual section.
      const docNums = numbersIn(sec.content).filter((n) => n > 0 && n < 100000);
      const near = docNums.find((n) => structuredNums.every((sn) => Math.abs(sn - n) / Math.max(sn, n) < 0.35 && sn !== n));
      if (near !== undefined) {
        out.push({
          label: s.label,
          left: { source: "Garage Library", value: s.value },
          right: {
            source: `${sec.manufacturer} ${sec.title}${sec.version ? ` v${sec.version}` : ""}`,
            value: String(near),
          },
        });
      }
      break;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * ORCHESTRATION
 * ------------------------------------------------------------------ */

export async function askTech(
  question: string,
  bike: BikeContext,
  opts: { allowExternalAi?: boolean } = {},
): Promise<TechAnswer> {
  const key = cacheKey(question, bike);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    const answer = { ...cached.answer, cacheHit: true };
    void logQuery(question, bike, answer);
    return answer;
  }

  const topic = detectTopic(question);
  const heading = topicHeading(topic, question);

  // 1. structured
  const { specs, badges } = await structuredLookup(topic, question, bike);

  // 2. documents (exact make/model/generation gate lives in the RPC)
  let sections: DocSection[] = [];
  try {
    const res = await searchDocuments({
      data: {
        question,
        make: bike.make ?? null,
        model: bike.model ?? null,
        year: bike.year ?? null,
        modelId: bike.modelId ?? null,
        limit: 5,
      },
    });
    sections = (res.sections ?? []) as DocSection[];
  } catch {
    sections = [];
  }

  for (const sec of sections.slice(0, 3)) {
    badges.push({
      kind: "document",
      label:
        sec.verification === "manufacturer_verified"
          ? "Manufacturer verified document"
          : sec.verification === "workshop_verified"
            ? "Workshop verified document"
            : "Document",
      detail: `${sec.manufacturer} ${sec.title}`,
      documentId: sec.document_id,
      version: sec.version,
      verification: sec.verification,
      reference: sectionReference(sec),
    });
  }

  // 3. workshop history
  const history = specs.length || sections.length ? [] : await historyLookup(topic, question, bike);

  const conflicts = detectConflicts(specs, sections);

  let source: AnswerSource = "none";
  if (specs.length) source = "structured";
  else if (sections.length) source = "document";
  else if (history.length) source = "history";

  // 4. external AI — last fallback only
  let aiText: string | null = null;
  if (source === "none" && (opts.allowExternalAi ?? true)) {
    try {
      const bikeLabel = [bike.year, bike.make, bike.model].filter(Boolean).join(" ");
      const res = await askExternalAi({
        data: { question, bike: bikeLabel || null, context: null },
      });
      aiText = res.answer || null;
      if (aiText) source = "external_ai";
    } catch (e) {
      aiText = e instanceof Error ? e.message : "External AI unavailable";
    }
  }

  const answer: TechAnswer = {
    question,
    topic,
    source,
    heading,
    specs: specs.length ? specs : history,
    sections,
    badges: source === "external_ai" ? [{ kind: "external_ai", label: "External AI — unverified" }] : badges,
    conflicts,
    aiText,
    usedExternalAi: source === "external_ai",
    cacheHit: false,
  };

  if (source !== "external_ai") cache.set(key, { at: Date.now(), answer });
  answer.queryId = await logQuery(question, bike, answer);
  return answer;
}

export function topicHeading(topic: TechTopic, question: string) {
  switch (topic) {
    case "valve":
      return "VALVE CLEARANCE";
    case "fluid":
      return "FLUIDS & CAPACITIES";
    case "torque":
      return "TIGHTENING TORQUE";
    case "part":
      return "PARTS";
    case "labour":
      return "LABOUR REFERENCE";
    case "procedure":
      return "PROCEDURE";
    default:
      return question.toUpperCase().slice(0, 60);
  }
}

export function sectionReference(sec: DocSection) {
  const parts: string[] = [];
  if (sec.heading) parts.push(sec.heading);
  if (sec.page_from) parts.push(sec.page_to && sec.page_to !== sec.page_from ? `pp. ${sec.page_from}–${sec.page_to}` : `p. ${sec.page_from}`);
  // No page/section invented: empty when retrieval carries no reference.
  return parts.join(" · ");
}

export const docGenerationLabel = (sec: {
  generation: string | null;
  year_from: number | null;
  year_to: number | null;
}) =>
  sec.generation ??
  (sec.year_from || sec.year_to ? `${sec.year_from ?? "?"}–${sec.year_to ?? "?"}` : "—");

async function logQuery(question: string, bike: BikeContext, a: TechAnswer) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("garage_queries")
    .insert({
      question,
      question_norm: normQuestion(question),
      topic: a.topic,
      model_id: bike.modelId ?? null,
      motorcycle_id: bike.motorcycleId ?? null,
      job_id: bike.jobId ?? null,
      answer_source: a.source,
      answered: a.source !== "none",
      document_id: a.sections[0]?.document_id ?? null,
      answer_summary: a.specs[0] ? `${a.specs[0].label}: ${a.specs[0].value}` : (a.aiText ?? "").slice(0, 300),
      used_external_ai: a.usedExternalAi,
      cache_hit: a.cacheHit,
      needs_verification: a.source === "external_ai" || a.source === "none",
      asked_by: uid,
    })
    .select("id")
    .single();
  if (error) return null;
  return data.id;
}

export async function sendAnswerFeedback(
  queryId: string,
  helpful: boolean,
  reason?: string,
  note?: string,
) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("garage_answer_feedback").insert({
    query_id: queryId,
    helpful,
    reason: reason ?? null,
    note: note ?? null,
    created_by: auth.user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export const FEEDBACK_REASONS = [
  "Wrong generation",
  "Wrong specification",
  "Outdated",
  "Not relevant",
  "Other",
];

/**
 * Pull a candidate structured value out of a manual section so the user can
 * review and confirm it. Extraction is always user-requested — manuals are
 * never bulk-imported into the Garage Library.
 */
export function extractCandidate(section: DocSection, question: string) {
  const sentences = section.content.split(/(?<=[.\n;])\s+/);
  const words = normQuestion(question).split(" ").filter((w) => w.length > 3);
  const hit =
    sentences.find((s) => {
      const n = normQuestion(s);
      return words.some((w) => n.includes(w)) && /\d/.test(s);
    }) ?? sentences.find((s) => /\d/.test(s));
  if (!hit) return null;
  const nm = hit.match(/(\d+(?:[.,]\d+)?)\s*(nm|n·m|n\.m)/i);
  const mm = hit.match(/(\d+(?:[.,]\d+)?)\s*mm/i);
  const litres = hit.match(/(\d+(?:[.,]\d+)?)\s*(l|litre|liter|ltr)\b/i);
  const value = nm?.[1] ?? mm?.[1] ?? litres?.[1] ?? (hit.match(/\d+(?:[.,]\d+)?/)?.[0] ?? "");
  const unit = nm ? "Nm" : mm ? "mm" : litres ? "L" : "";
  const component = hit
    .replace(/\s+/g, " ")
    .replace(/[:.].*$/, "")
    .trim()
    .slice(0, 60);
  return { component, value: value.replace(",", "."), unit, sentence: hit.trim(), section };
}
