import { supabase } from "@/integrations/supabase/client";
import { getValveSpec, type ValveSpec } from "@/lib/valve-specs";

export type SavedValveSpec = {
  id: string;
  make: string;
  model: string;
  intake_min: number;
  intake_max: number;
  exhaust_min: number;
  exhaust_max: number;
  cylinders: number;
  intake_on_top: boolean;
  note: string | null;
};

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();

/** Look up a workshop-saved spec for this make/model (exact, case-insensitive). */
export async function fetchSavedValveSpec(
  make?: string | null,
  model?: string | null,
): Promise<SavedValveSpec | null> {
  if (!norm(make) || !norm(model)) return null;
  const { data, error } = await supabase
    .from("valve_clearance_specs")
    .select("id, make, model, intake_min, intake_max, exhaust_min, exhaust_max, cylinders, intake_on_top, note")
    .ilike("make", (make ?? "").trim())
    .ilike("model", (model ?? "").trim())
    .maybeSingle();
  if (error) return null;
  return (data as SavedValveSpec | null) ?? null;
}

/** Insert or update the saved spec for a make/model. */
export async function upsertSavedValveSpec(input: {
  id?: string | null;
  make: string;
  model: string;
  intake: [number, number];
  exhaust: [number, number];
  cylinders: number;
  intakeOnTop: boolean;
  note?: string | null;
}) {
  const payload = {
    make: input.make.trim(),
    model: input.model.trim(),
    intake_min: input.intake[0],
    intake_max: input.intake[1],
    exhaust_min: input.exhaust[0],
    exhaust_max: input.exhaust[1],
    cylinders: input.cylinders,
    intake_on_top: input.intakeOnTop,
    note: input.note ?? null,
  };
  if (input.id) {
    return supabase.from("valve_clearance_specs").update(payload).eq("id", input.id).select().maybeSingle();
  }
  return supabase.from("valve_clearance_specs").insert(payload).select().maybeSingle();
}

/** Merge a saved spec (if any) over the built-in manufacturer table. */
export function resolveValveSpec(
  saved: SavedValveSpec | null,
  bike?: { make?: string | null; model?: string | null; year?: number | null } | null,
): ValveSpec {
  if (saved) {
    return {
      intake: [Number(saved.intake_min), Number(saved.intake_max)],
      exhaust: [Number(saved.exhaust_min), Number(saved.exhaust_max)],
      source: `Workshop saved · ${saved.make} ${saved.model}`,
      note: saved.note ?? undefined,
    };
  }
  return getValveSpec(bike?.make, bike?.model, bike?.year);
}
