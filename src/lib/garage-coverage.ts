import { supabase } from "@/integrations/supabase/client";

export type CoverageState = "complete" | "partial" | "missing";

/**
 * Coverage is counted from real records in defined categories — never a
 * fabricated percentage.
 */
export const COVERAGE_CATEGORIES = [
  { key: "fluids", label: "Fluids", complete: 2 },
  { key: "parts", label: "Common parts", complete: 3 },
  { key: "labour", label: "Labour", complete: 3 },
  { key: "torque", label: "Torque specs", complete: 5 },
  { key: "valves", label: "Valves", complete: 1 },
  { key: "documents", label: "Manual", complete: 1 },
  { key: "checklists", label: "Procedures", complete: 1 },
] as const satisfies ReadonlyArray<{ key: string; label: string; complete: number }>;

export type CoverageKey = (typeof COVERAGE_CATEGORIES)[number]["key"];

export async function coverageRows(modelId: string): Promise<Record<CoverageKey, CoverageState>> {
  const [{ data }, checklists] = await Promise.all([
    supabase.rpc("garage_knowledge_coverage", { p_model_id: modelId }),
    supabase
      .from("garage_checklists")
      .select("id", { count: "exact", head: true })
      .eq("model_id", modelId)
      .eq("is_archived", false),
  ]);
  const counts: Record<string, number> = {
    ...((data ?? {}) as Record<string, number>),
    checklists: checklists.count ?? 0,
  };
  const out = {} as Record<CoverageKey, CoverageState>;
  for (const c of COVERAGE_CATEGORIES) {
    const n = Number(counts[c.key] ?? 0);
    out[c.key] = n === 0 ? "missing" : n >= c.complete ? "complete" : "partial";
  }
  return out;
}
