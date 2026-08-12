import { supabase } from "@/integrations/supabase/client";
import { norm, splitCsvLine, type CatalogueModel } from "@/lib/garage-catalogue";

/**
 * Garage Library — Phase 3
 * Structured technical knowledge: categories, source tracking, verification,
 * import pipeline with conflict handling and coverage/missing-data reporting.
 * This module never researches data; it only stores curated datasets.
 */

/* ---------------- Verification & sources ---------------- */

export const TECH_VERIFICATIONS = [
  { value: "unverified", label: "Unverified", tone: "border-amber-500/40 bg-amber-500/10 text-amber-400" },
  { value: "workshop_verified", label: "Workshop verified", tone: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" },
  { value: "manufacturer_verified", label: "Manufacturer verified", tone: "border-sky-500/40 bg-sky-500/10 text-sky-400" },
  { value: "supplier_verified", label: "Supplier verified", tone: "border-violet-500/40 bg-violet-500/10 text-violet-400" },
] as const;

export type TechVerification = (typeof TECH_VERIFICATIONS)[number]["value"];

export const techVerification = (v: string | null | undefined) =>
  TECH_VERIFICATIONS.find((x) => x.value === v) ?? TECH_VERIFICATIONS[0];

export const TECH_SOURCE_TYPES = [
  { value: "manufacturer_document", label: "Manufacturer document" },
  { value: "workshop_manual", label: "Workshop manual" },
  { value: "supplier", label: "Verified supplier" },
  { value: "workshop_observation", label: "Workshop observation" },
  { value: "previous_job", label: "Previous job" },
  { value: "external_research", label: "External research" },
  { value: "manual_entry", label: "Manual entry" },
] as const;

export type TechSourceType = (typeof TECH_SOURCE_TYPES)[number]["value"];

export const techSourceLabel = (s: string | null | undefined) =>
  TECH_SOURCE_TYPES.find((x) => x.value === s)?.label ?? "Manual entry";

/** Source priority — lower number wins when two values disagree. */
export const SOURCE_PRIORITY: Record<string, number> = {
  manufacturer_document: 1,
  workshop_manual: 2,
  supplier: 3,
  workshop_observation: 4,
  previous_job: 4,
  external_research: 5,
  manual_entry: 5,
};

const VERIFICATION_PRIORITY: Record<string, number> = {
  manufacturer_verified: 1,
  workshop_verified: 2,
  supplier_verified: 3,
  unverified: 4,
};

export function sourceRank(spec: { source_type?: string | null; verification?: string | null }) {
  return (
    (VERIFICATION_PRIORITY[spec.verification ?? "unverified"] ?? 4) * 10 +
    (SOURCE_PRIORITY[spec.source_type ?? "manual_entry"] ?? 5)
  );
}

/** Trusted source types allowed to arrive already verified from an import. */
const TRUSTED_IMPORT_SOURCES = new Set(["manufacturer_document", "workshop_manual", "supplier"]);

/* ---------------- Categories & fields ---------------- */

export type TechField = { key: string; label: string; unit?: string; numeric?: boolean };

export type TechCategory = {
  key: string;
  label: string;
  /** Whether rows are grouped by a free-text subject (e.g. fastener, fluid type). */
  subjectLabel?: string;
  safetyCritical?: boolean;
  fields: TechField[];
};

export const TECH_CATEGORIES: TechCategory[] = [
  {
    key: "engine_oil",
    label: "Engine oil",
    safetyCritical: true,
    fields: [
      { key: "oil_viscosity", label: "Viscosity" },
      { key: "oil_standard", label: "Specification / standard" },
      { key: "oil_capacity_dry_l", label: "Capacity dry", unit: "L", numeric: true },
      { key: "oil_capacity_change_l", label: "Capacity oil change", unit: "L", numeric: true },
      { key: "oil_capacity_filter_l", label: "Capacity with filter", unit: "L", numeric: true },
      { key: "oil_filter_part", label: "Oil filter part no." },
      { key: "oil_notes", label: "Notes" },
    ],
  },
  {
    key: "fluids",
    label: "Other fluids",
    subjectLabel: "Fluid",
    safetyCritical: true,
    fields: [
      { key: "type", label: "Specification / type" },
      { key: "amount", label: "Amount", numeric: true },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "filters",
    label: "Filters",
    subjectLabel: "Filter",
    fields: [
      { key: "oem_part", label: "OEM part number" },
      { key: "aftermarket_part", label: "Aftermarket equivalent" },
      { key: "brand", label: "Brand" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "spark_plugs",
    label: "Spark plugs",
    fields: [
      { key: "manufacturer", label: "Manufacturer" },
      { key: "part_number", label: "Part number" },
      { key: "gap_mm", label: "Gap", unit: "mm", numeric: true },
      { key: "alternative", label: "Alternative plug" },
      { key: "performance", label: "Performance / racing" },
      { key: "torque_nm", label: "Torque", unit: "Nm", numeric: true },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "valves",
    label: "Valve clearances",
    safetyCritical: true,
    fields: [
      { key: "intake_min", label: "Intake min", unit: "mm", numeric: true },
      { key: "intake_max", label: "Intake max", unit: "mm", numeric: true },
      { key: "exhaust_min", label: "Exhaust min", unit: "mm", numeric: true },
      { key: "exhaust_max", label: "Exhaust max", unit: "mm", numeric: true },
      { key: "condition", label: "Measurement condition (COLD / HOT)" },
      { key: "inspection_interval", label: "Inspection interval" },
      { key: "adjustment_notes", label: "Adjustment notes" },
      { key: "labour_reference", label: "Labour reference", unit: "h", numeric: true },
    ],
  },
  {
    key: "torque",
    label: "Torque specs",
    subjectLabel: "Component",
    safetyCritical: true,
    fields: [
      { key: "system", label: "System" },
      { key: "torque", label: "Torque", unit: "Nm", numeric: true },
      { key: "sequence_notes", label: "Sequence notes" },
      { key: "thread_prep", label: "Thread preparation" },
    ],
  },
  {
    key: "tyres",
    label: "Tyres",
    safetyCritical: true,
    fields: [
      { key: "front_size", label: "Front size" },
      { key: "rear_size", label: "Rear size" },
      { key: "front_pressure", label: "Front pressure", unit: "psi", numeric: true },
      { key: "rear_pressure", label: "Rear pressure", unit: "psi", numeric: true },
      { key: "alternative_sizes", label: "Approved alternative sizes" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "brakes",
    label: "Brakes",
    safetyCritical: true,
    fields: [
      { key: "front_pads", label: "Front pads" },
      { key: "front_pad_part", label: "Front pad part no." },
      { key: "rear_pads", label: "Rear pads" },
      { key: "rear_pad_part", label: "Rear pad part no." },
      { key: "front_disc_min_mm", label: "Front disc min thickness", unit: "mm", numeric: true },
      { key: "rear_disc_min_mm", label: "Rear disc min thickness", unit: "mm", numeric: true },
      { key: "brake_fluid", label: "Brake fluid" },
      { key: "caliper_torque_nm", label: "Caliper bolt torque", unit: "Nm", numeric: true },
    ],
  },
  {
    key: "drive",
    label: "Chain / final drive",
    fields: [
      { key: "drive_type", label: "Drive type (chain / belt / shaft)" },
      { key: "chain_size", label: "Chain size" },
      { key: "chain_links", label: "Links", numeric: true },
      { key: "front_sprocket", label: "Front sprocket", numeric: true },
      { key: "rear_sprocket", label: "Rear sprocket", numeric: true },
      { key: "chain_slack", label: "Chain slack", unit: "mm" },
      { key: "final_drive_oil", label: "Final drive oil / belt spec" },
    ],
  },
  {
    key: "battery",
    label: "Battery",
    fields: [
      { key: "battery_type", label: "Type" },
      { key: "part_number", label: "Part number" },
      { key: "capacity_ah", label: "Capacity", unit: "Ah", numeric: true },
      { key: "cca", label: "CCA", numeric: true },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "cooling",
    label: "Cooling",
    fields: [
      { key: "coolant_type", label: "Coolant type" },
      { key: "capacity_l", label: "System capacity", unit: "L", numeric: true },
      { key: "cap_pressure", label: "Cap pressure" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "suspension",
    label: "Fork / suspension",
    fields: [
      { key: "fork_oil", label: "Fork oil grade" },
      { key: "fork_oil_volume_ml", label: "Fork oil volume per leg", unit: "ml", numeric: true },
      { key: "fork_oil_level_mm", label: "Oil level", unit: "mm", numeric: true },
      { key: "fork_seal_part", label: "Fork seal part no." },
      { key: "rear_shock", label: "Rear shock notes" },
      { key: "sag_setting", label: "Sag setting" },
    ],
  },
  {
    key: "service_intervals",
    label: "Service intervals",
    subjectLabel: "Item",
    fields: [
      { key: "interval", label: "Interval", numeric: true },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "common_parts",
    label: "Common parts",
    subjectLabel: "Part",
    fields: [
      { key: "part_number", label: "Part number" },
      { key: "brand", label: "Brand" },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "labour",
    label: "Standard labour",
    subjectLabel: "Operation",
    fields: [
      { key: "hours", label: "Reference hours", unit: "h", numeric: true },
      { key: "notes", label: "Notes" },
    ],
  },
  {
    key: "procedures",
    label: "Workshop procedures",
    subjectLabel: "Procedure",
    fields: [
      { key: "procedure", label: "Procedure" },
      { key: "special_tools", label: "Special tools" },
    ],
  },
  {
    key: "tech_notes",
    label: "Technical notes",
    subjectLabel: "Topic",
    fields: [{ key: "note", label: "Note" }],
  },
];

export const techCategory = (key: string) => TECH_CATEGORIES.find((c) => c.key === key);

export const techCategoryLabel = (key: string) => techCategory(key)?.label ?? key;

export const techFieldLabel = (category: string, field: string) =>
  techCategory(category)?.fields.find((f) => f.key === field)?.label ?? field;

export const isSafetyCritical = (category: string) => Boolean(techCategory(category)?.safetyCritical);

export const SERVICE_INTERVAL_ITEMS = [
  "Oil service",
  "Major service",
  "Valve inspection",
  "Air filter",
  "Spark plugs",
  "Coolant",
  "Brake fluid",
];

export const LABOUR_OPERATIONS = [
  "Basic Service",
  "Full Service",
  "Fork Seal Replacement",
  "Valve Clearance Inspection",
  "Valve Adjustment",
  "Front Brake Pads",
  "Rear Brake Pads",
  "Chain & Sprockets",
  "Tyres",
  "Clutch",
  "Coolant",
  "Steering Bearings",
  "Wheel Bearings",
  "Tuning",
  "Diagnostic",
];

export const FLUID_SUBJECTS = [
  "Coolant",
  "Brake fluid",
  "Clutch fluid",
  "Fork oil",
  "Gearbox oil",
  "Primary oil",
  "Final drive oil",
  "Other",
];

/* ---------------- Row type ---------------- */

export type TechSpec = {
  id: string;
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
  source_date: string | null;
  verification: string;
  verified_by: string | null;
  verified_at: string | null;
  is_alternative: boolean;
  review_status: string;
  import_batch: string | null;
  is_archived: boolean;
  updated_at: string;
};

export const specValue = (s: Pick<TechSpec, "value_text" | "value_num" | "unit">) => {
  const base = s.value_text ?? (s.value_num !== null && s.value_num !== undefined ? String(s.value_num) : "");
  if (!base) return "—";
  return s.unit ? `${base} ${s.unit}` : base;
};

/* ---------------- Import pipeline ---------------- */

export const TECH_IMPORT_COLUMNS = [
  "make",
  "model",
  "generation",
  "year_from",
  "year_to",
  "category",
  "subject",
  "field",
  "value",
  "unit",
  "notes",
  "source_type",
  "source_name",
  "source_ref",
  "source_date",
  "verification",
] as const;

export type TechImportRow = {
  make: string;
  model: string;
  generation: string | null;
  year_from: number | null;
  year_to: number | null;
  category: string;
  subject: string;
  field: string;
  value: string;
  unit: string | null;
  notes: string | null;
  source_type: string;
  source_name: string | null;
  source_ref: string | null;
  source_date: string | null;
  verification: string;
};

export type TechImportStatus = "new" | "duplicate" | "conflict" | "invalid";
export type ConflictResolution = "keep" | "alternative" | "review" | "replace";

export type TechPreviewRow = {
  row: TechImportRow;
  status: TechImportStatus;
  reason: string;
  modelId?: string;
  modelLabel?: string;
  existing?: TechSpec;
  resolution: ConflictResolution;
};

const clean = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

const toInt = (v: unknown) => {
  const s = String(v ?? "").trim();
  const n = Number(s);
  return s !== "" && Number.isFinite(n) ? Math.trunc(n) : null;
};

export const toNum = (v: unknown) => {
  const s = String(v ?? "").trim().replace(/,/g, ".");
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
};

function toTechRow(raw: Record<string, unknown>): TechImportRow {
  const verificationIn = (clean(raw["verification"]) ?? "unverified").toLowerCase().replace(/\s+/g, "_");
  const sourceType = (clean(raw["source_type"]) ?? "manual_entry").toLowerCase().replace(/\s+/g, "_");
  return {
    make: String(raw["make"] ?? "").trim(),
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
    source_type: TECH_SOURCE_TYPES.some((s) => s.value === sourceType) ? sourceType : "manual_entry",
    source_name: clean(raw["source_name"]),
    source_ref: clean(raw["source_ref"]),
    source_date: clean(raw["source_date"]),
    verification: TECH_VERIFICATIONS.some((v) => v.value === verificationIn) ? verificationIn : "unverified",
  };
}

/** Accepts CSV (with header row) or a JSON array of objects. */
export function parseTechImport(text: string): TechImportRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((o) => toTechRow(o as Record<string, unknown>));
  }
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const obj: Record<string, unknown> = {};
    header.forEach((h, i) => (obj[h] = cells[i]));
    return toTechRow(obj);
  });
}

/**
 * Safety-critical values never arrive verified unless the dataset carries an
 * explicitly trusted source (type + named source).
 */
export function resolveImportVerification(row: TechImportRow): string {
  if (row.verification === "unverified") return "unverified";
  const trusted = TRUSTED_IMPORT_SOURCES.has(row.source_type) && Boolean(row.source_name);
  if (!trusted) return "unverified";
  if (isSafetyCritical(row.category) && !row.source_ref && !row.source_date) return "unverified";
  return row.verification;
}

/** Exact generation match is mandatory when a generation is supplied. */
export function matchModel(row: TechImportRow, models: CatalogueModel[]): CatalogueModel | null {
  const candidates = models.filter((m) => norm(m.make) === norm(row.make) && norm(m.model) === norm(row.model));
  if (candidates.length === 0) return null;
  if (row.generation) {
    const gen = candidates.filter((m) => norm(m.generation) === norm(row.generation));
    if (gen.length === 1) return gen[0];
    if (gen.length > 1 && row.year_from) {
      const y = gen.find((m) => (m.year_from ?? -99999) <= row.year_from! && (m.year_to ?? 99999) >= row.year_from!);
      return y ?? null;
    }
    return null;
  }
  if (row.year_from) {
    const byYear = candidates.filter(
      (m) => (m.year_from ?? -99999) <= row.year_from! && (m.year_to ?? 99999) >= row.year_from!,
    );
    return byYear.length === 1 ? byYear[0] : null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

const sameValue = (row: TechImportRow, existing: TechSpec) => {
  const num = toNum(row.value);
  if (existing.value_num !== null && num !== null) return Math.abs(existing.value_num - num) < 1e-9;
  return (existing.value_text ?? "").trim().toLowerCase() === row.value.trim().toLowerCase();
};

export function buildTechPreview(
  rows: TechImportRow[],
  models: CatalogueModel[],
  existing: TechSpec[],
): TechPreviewRow[] {
  const index = new Map<string, TechSpec>();
  for (const s of existing) {
    if (s.is_alternative || s.is_archived) continue;
    index.set(`${s.model_id}|${s.category}|${norm(s.subject)}|${s.field}`, s);
  }
  const seen = new Set<string>();
  return rows.map((row): TechPreviewRow => {
    if (!row.make || !row.model) return { row, status: "invalid", reason: "Make and model are required", resolution: "review" };
    if (!techCategory(row.category)) return { row, status: "invalid", reason: `Unknown category "${row.category}"`, resolution: "review" };
    if (!row.field) return { row, status: "invalid", reason: "Spec field is required", resolution: "review" };
    if (!row.value) return { row, status: "invalid", reason: "Value is required", resolution: "review" };

    const model = matchModel(row, models);
    if (!model) {
      return {
        row,
        status: "invalid",
        reason: "No exact generation match in the library — add the model first",
        resolution: "review",
      };
    }
    const key = `${model.id}|${row.category}|${norm(row.subject)}|${row.field}`;
    if (seen.has(key)) return { row, status: "invalid", reason: "Duplicated inside this file", modelId: model.id, resolution: "review" };
    seen.add(key);

    const label = `${model.make} ${model.model}${model.generation ? ` · ${model.generation}` : ""}`;
    const current = index.get(key);
    if (!current) return { row, status: "new", reason: "New technical value", modelId: model.id, modelLabel: label, resolution: "replace" };
    if (sameValue(row, current))
      return { row, status: "duplicate", reason: "Identical value already stored", modelId: model.id, modelLabel: label, existing: current, resolution: "keep" };

    const incomingRank = sourceRank({ source_type: row.source_type, verification: resolveImportVerification(row) });
    const keepExisting = sourceRank(current) <= incomingRank;
    return {
      row,
      status: "conflict",
      reason: keepExisting
        ? `Existing value is from a stronger source (${techVerification(current.verification).label})`
        : "Imported value comes from a stronger source",
      modelId: model.id,
      modelLabel: label,
      existing: current,
      resolution: keepExisting ? "review" : "alternative",
    };
  });
}

export async function importTechSpecs(preview: TechPreviewRow[], userId: string | null) {
  const batch = `import-${new Date().toISOString()}`;
  const inserts: Record<string, unknown>[] = [];
  const conflictFlags: string[] = [];
  let skipped = 0;

  for (const p of preview) {
    if (p.status === "invalid" || p.status === "duplicate" || !p.modelId) {
      skipped++;
      continue;
    }
    const verification = resolveImportVerification(p.row);
    const num = toNum(p.row.value);
    const base = {
      model_id: p.modelId,
      category: p.row.category,
      subject: p.row.subject,
      field: p.row.field,
      value_text: p.row.value,
      value_num: num,
      unit: p.row.unit,
      notes: p.row.notes,
      source_type: p.row.source_type,
      source_name: p.row.source_name,
      source_ref: p.row.source_ref,
      source_date: p.row.source_date,
      verification,
      is_alternative: false,
      review_status: "new_import",
      import_batch: batch,
      created_by: userId,
      updated_by: userId,
    };

    if (p.status === "new") {
      inserts.push(base);
      continue;
    }
    // conflict
    if (p.resolution === "keep") {
      skipped++;
      continue;
    }
    if (p.resolution === "replace" && p.existing) {
      const { error } = await supabase
        .from("garage_tech_specs")
        .update({ ...base, review_status: "needs_review" } as never)
        .eq("id", p.existing.id);
      if (error) throw error;
      continue;
    }
    // alternative / review both keep the existing primary and store the new value alongside
    inserts.push({ ...base, is_alternative: true, review_status: "needs_review" });
    if (p.existing) conflictFlags.push(p.existing.id);
  }

  if (inserts.length) {
    const { error } = await supabase.from("garage_tech_specs").insert(inserts as never);
    if (error) throw error;
  }
  if (conflictFlags.length) {
    const { error } = await supabase
      .from("garage_tech_specs")
      .update({ review_status: "needs_review" } as never)
      .in("id", conflictFlags);
    if (error) throw error;
  }
  return { inserted: inserts.length, skipped, batch };
}

/* ---------------- Missing knowledge ---------------- */

export const REQUIRED_TECH_FIELDS: { category: string; subject?: string; field: string; label: string }[] = [
  { category: "engine_oil", field: "oil_viscosity", label: "Engine oil viscosity" },
  { category: "engine_oil", field: "oil_capacity_filter_l", label: "Oil capacity with filter" },
  { category: "filters", subject: "Oil filter", field: "oem_part", label: "Oil filter part number" },
  { category: "filters", subject: "Air filter", field: "oem_part", label: "Air filter part number" },
  { category: "spark_plugs", field: "part_number", label: "Spark plug part number" },
  { category: "valves", field: "intake_min", label: "Valve clearance (intake)" },
  { category: "valves", field: "exhaust_min", label: "Valve clearance (exhaust)" },
  { category: "tyres", field: "front_size", label: "Front tyre size" },
  { category: "tyres", field: "rear_size", label: "Rear tyre size" },
  { category: "torque", subject: "Front axle", field: "torque", label: "Front axle torque" },
  { category: "torque", subject: "Rear axle", field: "torque", label: "Rear axle torque" },
  { category: "brakes", field: "front_pad_part", label: "Front brake pads" },
  { category: "suspension", field: "fork_oil", label: "Fork oil grade" },
  { category: "drive", field: "chain_size", label: "Chain size" },
  { category: "service_intervals", subject: "Oil service", field: "interval", label: "Oil service interval" },
];

export function missingKnowledge(specs: TechSpec[]) {
  const have = new Set(specs.filter((s) => !s.is_archived).map((s) => `${s.category}|${norm(s.subject)}|${s.field}`));
  return REQUIRED_TECH_FIELDS.map((r) => ({
    ...r,
    present: have.has(`${r.category}|${norm(r.subject ?? "")}|${r.field}`),
  }));
}

/* ---------------- Quick tech sheet ---------------- */

export const QUICK_SHEET_SECTIONS: { key: string; label: string; categories: string[] }[] = [
  { key: "oil", label: "Engine oil", categories: ["engine_oil"] },
  { key: "filters", label: "Filters", categories: ["filters"] },
  { key: "plugs", label: "Spark plugs", categories: ["spark_plugs"] },
  { key: "valves", label: "Valve clearances", categories: ["valves"] },
  { key: "tyres", label: "Tyres", categories: ["tyres"] },
  { key: "brakes", label: "Brakes", categories: ["brakes"] },
  { key: "drive", label: "Chain / final drive", categories: ["drive"] },
  { key: "fluids", label: "Other fluids", categories: ["fluids", "cooling", "suspension"] },
  { key: "torque", label: "Key torques", categories: ["torque"] },
  { key: "intervals", label: "Service intervals", categories: ["service_intervals"] },
  { key: "labour", label: "Common jobs", categories: ["labour"] },
];

export function groupSpecs(specs: TechSpec[]) {
  const map = new Map<string, TechSpec[]>();
  for (const s of specs) {
    if (s.is_archived) continue;
    const list = map.get(s.category) ?? [];
    list.push(s);
    map.set(s.category, list);
  }
  return map;
}
