/**
 * House rule for how a part is written on job cards, inventory and invoices
 * (the format used on invoice MCD-2026-01057):
 *
 *   ITEM        = what kind of part/work it is, in plain words
 *                 (e.g. "Engine Oil", "Oil Filter", "Primary Oil", "Consumables")
 *   DESCRIPTION = the exact product used
 *                 (e.g. "Motul Twin syn 20w-50", "HiFlo HF204 Oil Filter")
 *
 * Storage mapping (unchanged so existing screens keep working):
 *   parts.part_number      -> ITEM          parts.supplier / parts.name -> DESCRIPTION
 *   inventory_items.sku    -> ITEM          inventory_items.name        -> DESCRIPTION
 */
import { categoryLabel, guessInventoryCategory } from "./inventory-categories";

/** Canonical ITEM labels, keyed by the lowercase text we may find in the data. */
const CANONICAL: Record<string, string> = {
  "engine oil": "Engine Oil",
  "motor oil": "Engine Oil",
  oil: "Engine Oil",
  "primary oil": "Primary Oil",
  "final drive oil": "Final Drive Oil",
  "gear oil": "Gear Oil",
  "transmission oil": "Gear Oil",
  "fork oil": "Fork Oil",
  "oil filter": "Oil Filter",
  "air filter": "Air Filter",
  "fuel filter": "Fuel Filter",
  "spark plug": "Spark Plugs",
  "spark plugs": "Spark Plugs",
  "hd spark-plug": "Spark Plugs",
  "brake pad": "Brake Pads",
  "brake pads": "Brake Pads",
  "brake disc": "Brake Discs",
  "brake fluid": "Brake Fluid",
  "brake fluids": "Brake Fluid",
  coolant: "Coolant",
  chain: "Chain",
  sprocket: "Sprocket",
  "chain lube": "Chain Lube",
  "chain cleaner": "Chain Cleaner",
  tyre: "Tyre",
  tire: "Tyre",
  "front tyre": "Front Tyre",
  "rear tyre": "Rear Tyre",
  battery: "Battery",
  "fork seal": "Fork Seals",
  "fork seals": "Fork Seals",
  "dust seals": "Dust Seals",
  gasket: "Gasket",
  "valve cover gasket": "Valve Cover Gasket",
  consumables: "Consumables",
  "shop consumables": "Consumables",
  "workshop consumables": "Consumables",
  wof: "WOF",
  "warrant of fitness": "WOF",
  "carry fee": "Carry Fee",
  "ecu scan": "ECU Scan",
  tuning: "Tuning",
  dyno: "Tuning",
  fuel: "Fuel",
  labour: "Labour",
};

/** Category -> ITEM label used when we have to work the type out ourselves. */
const CATEGORY_ITEM: Record<string, string> = {
  oil: "Engine Oil",
  oil_filter: "Oil Filter",
  air_filter: "Air Filter",
  fuel_filter: "Fuel Filter",
  spark_plug: "Spark Plugs",
  brake_pad: "Brake Pads",
  brake_disc: "Brake Discs",
  brake_fluid: "Brake Fluid",
  coolant: "Coolant",
  fork_oil: "Fork Oil",
  chain: "Chain",
  sprocket: "Sprocket",
  chain_lube: "Chain Lube",
  chain_clean: "Chain Cleaner",
  tyre: "Tyre",
  tube: "Tube",
  battery: "Battery",
  bulb: "Electrical",
  cable: "Cable",
  bearing: "Bearings / Seals",
  gasket: "Gasket",
  belt: "Belt",
  clutch: "Clutch",
  engine_part: "Engine Part",
  handlebars: "Handlebars",
  bodywork: "Bodywork",
  fastener: "Hardware",
  consumable: "Consumables",
  accessory: "Accessory",
  part: "Part",
};

const BRANDS =
  /(motul|castrol|spectro|shell|elf|ngk|denso|hiflo|hf\d|hfa\d|vesrah|michelin|pirelli|dunlop|bridgestone|shinko|metzeler|continental|did|rk |ek |yuasa|k&n|brembo|ebc|sbs|tourmax|kiwix|protaper|renthal)/i;

const clean = (v?: string | null) => (v ?? "").toString().trim();
const low = (v?: string | null) => clean(v).toLowerCase();

/** Turn any text into a canonical ITEM label, or null when it isn't a type. */
export function canonicalItemLabel(text?: string | null): string | null {
  const t = clean(text);
  if (t.length < 2) return null;
  const key = low(t).replace(/\s{2,}/g, " ").replace(/[.]+$/, "");
  if (CANONICAL[key]) return CANONICAL[key];
  // Plain words, no part-number-looking tokens and no brand names → it already
  // reads like a type ("Spark Plug Tunnel Seals", "Engineering Outwork").
  const words = t.split(/\s+/);
  if (words.length <= 4 && !/\d/.test(t) && !BRANDS.test(t) && /^[A-Za-z][A-Za-z\s&/'-]*$/.test(t)) {
    return t.replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return null;
}

/** True when the text looks like a manufacturer code rather than a description. */
export function looksLikeCode(text?: string | null): boolean {
  const t = clean(text);
  if (!t || t.includes(" ")) return false;
  return /^[A-Za-z0-9][A-Za-z0-9./-]{2,15}$/.test(t) && /\d/.test(t);
}

/** Pull a manufacturer code out of free text ("NGK CR9EK" -> "CR9EK"). */
export function extractPartCode(text?: string | null): string | null {
  const t = clean(text);
  if (!t) return null;
  for (const raw of t.split(/[\s,/()]+/).filter(Boolean)) {
    const tok = raw.replace(/[^A-Za-z0-9-]/g, "");
    if (tok.length < 3 || tok.length > 16) continue;
    if (!/[0-9]/.test(tok) || !/[A-Za-z]/.test(tok)) continue;
    if (/^\d+(w|W)-?\d+$/.test(tok)) continue; // 10W-40 is a grade, not a code
    if (/^(dot\d|\d+ml|\d+l|\d+mm|\d+cc|\d+x\d+)$/i.test(tok)) continue;
    return tok.toUpperCase();
  }
  return null;
}

type PartLike = {
  name?: string | null;
  sku?: string | null;
  part_number?: string | null;
  brand?: string | null;
  supplier?: string | null;
  description?: string | null;
  category?: string | null;
};

/** ITEM column — the kind of part/work, in plain words. */
export function derivePartItem(input: PartLike): string {
  for (const candidate of [input.part_number, input.sku, input.description, input.supplier, input.name]) {
    const label = canonicalItemLabel(candidate);
    if (label) return label;
  }
  const text = [input.name, input.description, input.supplier, input.part_number, input.sku]
    .map(clean)
    .filter(Boolean)
    .join(" ");
  const cat = clean(input.category) || guessInventoryCategory(text);
  return CATEGORY_ITEM[cat] ?? categoryLabel(cat);
}

/** DESCRIPTION column — the exact product used. */
export function derivePartDescription(input: PartLike): string {
  const item = low(derivePartItem(input));
  const candidates = [input.description, input.supplier, input.name, input.part_number, input.sku]
    .map(clean)
    .filter((c) => c.length > 1 && low(c) !== item);

  // Prefer text that names a real product (brand, code or measurements).
  const product = candidates.find((c) => BRANDS.test(c) || /\d/.test(c) || c.split(/\s+/).length > 3);
  const fallback = candidates.find((c) => !canonicalItemLabel(c)) ?? candidates[0];
  const chosen = product ?? fallback ?? "";
  if (chosen) return chosen;

  const brand = clean(input.brand);
  return brand ? `${brand} ${derivePartItem(input)}` : derivePartItem(input);
}

/**
 * Legacy name kept so existing callers keep compiling: this now returns the
 * ITEM label (the plain-words type), not a made-up code.
 */
export function derivePartNumber(input: PartLike, opts?: { invent?: boolean }): string {
  const label = derivePartItem(input);
  if (opts?.invent === false && !label) return "";
  return label;
}

/** Item + description pair for any part-like record. */
export function partDisplay(input: PartLike, _opts?: { invent?: boolean }) {
  return {
    item: derivePartItem(input),
    description: derivePartDescription(input),
  };
}
