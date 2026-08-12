import { supabase } from "@/integrations/supabase/client";

/** Where a piece of technical knowledge came from. */
export const GARAGE_SOURCES = [
  { value: "workshop_verified", label: "Workshop Verified" },
  { value: "manufacturer_manual", label: "Manufacturer Manual" },
  { value: "parts_supplier", label: "Parts Supplier" },
  { value: "previous_job", label: "Previous Job" },
  { value: "technician_entry", label: "Technician Entry" },
  { value: "other", label: "Other" },
] as const;

export type GarageSource = (typeof GARAGE_SOURCES)[number]["value"];

export const GARAGE_VERIFICATIONS = [
  { value: "unverified", label: "UNVERIFIED", tone: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
  { value: "workshop_verified", label: "WORKSHOP VERIFIED", tone: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  { value: "manufacturer_verified", label: "MANUFACTURER VERIFIED", tone: "text-sky-400 border-sky-500/40 bg-sky-500/10" },
] as const;

export type GarageVerification = (typeof GARAGE_VERIFICATIONS)[number]["value"];

export const sourceLabel = (s: string | null | undefined) =>
  GARAGE_SOURCES.find((x) => x.value === s)?.label ?? "Unknown source";

export const verification = (v: string | null | undefined) =>
  GARAGE_VERIFICATIONS.find((x) => x.value === v) ?? GARAGE_VERIFICATIONS[0];

/** Standard workshop operations offered as quick-add labour references. */
export const STANDARD_OPERATIONS = [
  "Basic Service",
  "Full Service",
  "Fork Seals",
  "Valve Clearance Inspection",
  "Valve Adjustment",
  "Chain & Sprockets",
  "Front Brake Pads",
  "Rear Brake Pads",
  "Tyres",
  "Wheel Bearings",
  "Steering Head Bearings",
  "Clutch",
  "Cooling System",
  "Tuning",
  "Diagnostic",
];

/** Common torque fasteners offered as quick-add rows. */
export const COMMON_FASTENERS = [
  "Front axle",
  "Rear axle",
  "Front caliper bolts",
  "Rear caliper",
  "Drain plug",
  "Oil filter",
  "Spark plugs",
  "Triple clamps",
  "Handlebars",
  "Engine mounts",
  "Sprocket nut",
];

export const FLUID_TYPES = [
  "Engine oil",
  "Gearbox oil",
  "Final drive oil",
  "Coolant",
  "Brake fluid",
  "Clutch fluid",
  "Fork oil",
  "Other",
];

export const PART_CATEGORIES = [
  "Oil Filter",
  "Air Filter",
  "Spark Plugs",
  "Brake Pads",
  "Brake Discs",
  "Fork Seals",
  "Chain",
  "Sprockets",
  "Wheel Bearings",
  "Battery",
  "Tyres",
  "Other",
];

export type ModelRow = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  engine_cc: number | null;
  year_from: number | null;
  year_to: number | null;
  cylinders: number;
  notes: string | null;
  photo_url: string | null;
  is_archived: boolean;
  updated_at: string;
};

export const modelTitle = (m: Pick<ModelRow, "make" | "model">) =>
  `${m.make} ${m.model}`.replace(/\s+/g, " ").trim();

export const yearLabel = (m: Pick<ModelRow, "year_from" | "year_to">) => {
  if (!m.year_from && !m.year_to) return "Year unknown";
  if (m.year_from && m.year_to && m.year_from !== m.year_to) return `${m.year_from}–${m.year_to}`;
  return String(m.year_from ?? m.year_to);
};

/** Records an immutable revision entry so technical values are never silently overwritten. */
export async function logRevision(entry: {
  modelId: string;
  entityTable: string;
  entityId?: string | null;
  field?: string | null;
  label: string;
  oldValue?: string | null;
  newValue?: string | null;
  action?: "create" | "update" | "archive" | "verify" | "delete";
  note?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from("garage_revisions").insert({
    model_id: entry.modelId,
    entity_table: entry.entityTable,
    entity_id: entry.entityId ?? null,
    field: entry.field ?? null,
    label: entry.label,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    action: entry.action ?? "update",
    note: entry.note ?? null,
    created_by: auth.user?.id ?? null,
  });
}

/** Technicians propose changes instead of writing directly to verified knowledge. */
export async function proposeUpdate(entry: {
  modelId: string;
  entityTable: string;
  entityId?: string | null;
  label: string;
  field?: string | null;
  currentValue?: string | null;
  proposedValue: string;
  note?: string | null;
  source?: GarageSource;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("garage_update_proposals").insert({
    model_id: entry.modelId,
    entity_table: entry.entityTable,
    entity_id: entry.entityId ?? null,
    label: entry.label,
    field: entry.field ?? null,
    current_value: entry.currentValue ?? null,
    proposed_value: entry.proposedValue,
    note: entry.note ?? null,
    source: entry.source ?? "technician_entry",
    proposed_by: auth.user?.id ?? null,
  });
  if (error) throw error;
}

export const num = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && String(v).trim() !== "" ? n : null;
};
