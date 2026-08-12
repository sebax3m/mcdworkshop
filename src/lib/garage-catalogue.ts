import { supabase } from "@/integrations/supabase/client";

/** Phase 2 catalogue helpers: hierarchy, aliases, import parsing and matching. */

export const norm = (s: string | null | undefined) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const PRIORITY_TIERS = [
  { value: 1, label: "Tier 1 · Core workshop", tone: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  { value: 2, label: "Tier 2 · Common", tone: "text-sky-400 border-sky-500/40 bg-sky-500/10" },
  { value: 3, label: "Tier 3 · Occasional", tone: "text-muted-foreground border-border bg-muted/30" },
] as const;

export const priorityTier = (p: number | null | undefined) =>
  PRIORITY_TIERS.find((t) => t.value === (p ?? 2)) ?? PRIORITY_TIERS[1];

export type CatalogueModel = {
  id: string;
  make: string;
  model: string;
  generation: string | null;
  variant: string | null;
  engine: string | null;
  platform: string | null;
  category: string | null;
  priority: number | null;
  market_status: string | null;
  year_from: number | null;
  year_to: number | null;
};

export const generationLabel = (m: Pick<CatalogueModel, "generation" | "year_from" | "year_to">) => {
  const years =
    m.year_from && m.year_to && m.year_from !== m.year_to
      ? `${m.year_from}–${m.year_to}`
      : m.year_from
        ? `${m.year_from}–`
        : m.year_to
          ? `–${m.year_to}`
          : "Years unknown";
  return m.generation ? `${m.generation} · ${years}` : years;
};

/* ---------------- Import pipeline ---------------- */

export const IMPORT_COLUMNS = [
  "make",
  "model",
  "generation",
  "year_from",
  "year_to",
  "variant",
  "engine",
  "platform",
  "category",
  "priority",
  "market_status",
  "aliases",
] as const;

export type ImportRow = {
  make: string;
  model: string;
  generation: string | null;
  year_from: number | null;
  year_to: number | null;
  variant: string | null;
  engine: string | null;
  platform: string | null;
  category: string | null;
  priority: number;
  market_status: string | null;
  aliases: string[];
};

export type ImportStatus = "new" | "duplicate" | "conflict" | "invalid";

export type PreviewRow = {
  row: ImportRow;
  status: ImportStatus;
  reason: string;
  existingId?: string;
  existingLabel?: string;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const toInt = (v: unknown) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? Math.trunc(n) : null;
};

const clean = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
};

function toImportRow(raw: Record<string, unknown>): ImportRow {
  const aliasesRaw = clean(raw["aliases"]) ?? "";
  return {
    make: String(raw["make"] ?? "").trim(),
    model: String(raw["model"] ?? "").trim(),
    generation: clean(raw["generation"]),
    year_from: toInt(raw["year_from"]),
    year_to: toInt(raw["year_to"]),
    variant: clean(raw["variant"]),
    engine: clean(raw["engine"]),
    platform: clean(raw["platform"]),
    category: clean(raw["category"]),
    priority: Math.min(3, Math.max(1, toInt(raw["priority"]) ?? 2)),
    market_status: clean(raw["market_status"]),
    aliases: aliasesRaw
      .split(/[|;]/)
      .map((a) => a.trim())
      .filter(Boolean),
  };
}

/** Accepts CSV (with header row) or a JSON array of objects. */
export function parseImport(text: string): ImportRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((o) => toImportRow(o as Record<string, unknown>));
  }
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const obj: Record<string, unknown> = {};
    header.forEach((h, i) => (obj[h] = cells[i]));
    return toImportRow(obj);
  });
}

const yearsOverlap = (a: ImportRow, b: CatalogueModel) => {
  const af = a.year_from ?? -99999;
  const at = a.year_to ?? 99999;
  const bf = b.year_from ?? -99999;
  const bt = b.year_to ?? 99999;
  return af <= bt && at >= bf;
};

/** Never auto-merges: rows are classified so a human confirms every decision. */
export function buildPreview(rows: ImportRow[], existing: CatalogueModel[]): PreviewRow[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    if (!row.make || !row.model) {
      return { row, status: "invalid" as const, reason: "Make and model are required" };
    }
    if (row.year_from && row.year_to && row.year_to < row.year_from) {
      return { row, status: "invalid" as const, reason: "Year to is before year from" };
    }
    const key = `${norm(row.make)}|${norm(row.model)}|${norm(row.generation)}|${row.year_from ?? ""}`;
    if (seen.has(key)) return { row, status: "invalid" as const, reason: "Duplicated inside this file" };
    seen.add(key);

    const sameName = existing.filter(
      (e) => norm(e.make) === norm(row.make) && norm(e.model) === norm(row.model),
    );
    const exact = sameName.find(
      (e) => norm(e.generation) === norm(row.generation) && (e.year_from ?? null) === row.year_from,
    );
    if (exact) {
      return {
        row,
        status: "duplicate" as const,
        reason: "Already in the library",
        existingId: exact.id,
        existingLabel: `${exact.make} ${exact.model} ${generationLabel(exact)}`,
      };
    }
    const overlap = sameName.find((e) => yearsOverlap(row, e));
    if (overlap) {
      return {
        row,
        status: "conflict" as const,
        reason: "Year range overlaps an existing generation",
        existingId: overlap.id,
        existingLabel: `${overlap.make} ${overlap.model} ${generationLabel(overlap)}`,
      };
    }
    return { row, status: "new" as const, reason: "New model generation" };
  });
}

export async function importModels(rows: ImportRow[]) {
  const { data: auth } = await supabase.auth.getUser();
  let inserted = 0;
  let aliases = 0;
  for (const row of rows) {
    const { data, error } = await supabase
      .from("bike_library_models")
      .insert({
        make: row.make,
        model: row.model,
        generation: row.generation,
        year_from: row.year_from,
        year_to: row.year_to,
        variant: row.variant,
        engine: row.engine,
        platform: row.platform,
        category: row.category,
        priority: row.priority,
        market_status: row.market_status,
        cylinders: 1,
        created_by: auth.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    inserted++;
    if (row.aliases.length) {
      const { error: aErr } = await supabase.from("bike_library_model_aliases").insert(
        row.aliases.map((alias) => ({
          model_id: data.id,
          alias,
          alias_norm: norm(alias),
          created_by: auth.user?.id ?? null,
        })),
      );
      if (!aErr) aliases += row.aliases.length;
    }
    if (row.platform) {
      await supabase.from("bike_library_platforms").insert({ make: row.make, code: row.platform, name: row.platform });
    }
  }
  return { inserted, aliases };
}

/* ---------------- Matching workshop motorcycles ---------------- */

export type ModelSuggestion = {
  model_id: string;
  make: string;
  model: string;
  generation: string | null;
  year_from: number | null;
  year_to: number | null;
  platform: string | null;
  confidence: string;
  score: number;
};

export async function suggestModels(make: string, model: string, year?: number | null) {
  const { data, error } = await supabase.rpc("garage_suggest_models", {
    p_make: make,
    p_model: model,
    p_year: year ?? null,
  });
  if (error) throw error;
  return (data ?? []) as ModelSuggestion[];
}

export async function linkMotorcycleToModel(motorcycleId: string, modelId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("motorcycle_model_links")
    .upsert(
      { motorcycle_id: motorcycleId, model_id: modelId, confidence: "confirmed", confirmed_by: auth.user?.id ?? null },
      { onConflict: "motorcycle_id" },
    );
  if (error) throw error;
}

export async function unlinkMotorcycle(motorcycleId: string) {
  const { error } = await supabase.from("motorcycle_model_links").delete().eq("motorcycle_id", motorcycleId);
  if (error) throw error;
}
