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
  const { data } = await supabase.rpc("garage_knowledge_coverage", { p_model_id: modelId });
  const counts = (data ?? {}) as Record<string, number>;
  const out = {} as Record<CoverageKey, CoverageState>;
  for (const c of COVERAGE_CATEGORIES) {
    const n = Number(counts[c.key] ?? 0);
    out[c.key] = n === 0 ? "missing" : n >= c.complete ? "complete" : "partial";
  }
  return out;
}
