/**
 * Shared rules for how a part is shown on job cards, inventory and invoices:
 *   ITEM        = the part number / code   (e.g. "HD 6R12", "HF204")
 *   DESCRIPTION = what the part actually is (e.g. "Spark plug")
 *
 * Every new part gets a code automatically so the library stays tidy even when
 * a technician only types a plain name.
 */
import { categoryLabel, guessInventoryCategory } from "./inventory-categories";

/** Short prefixes used when we have to invent a code. */
const PREFIX: Record<string, string> = {
  oil: "OIL",
  oil_filter: "OFL",
  air_filter: "AFL",
  fuel_filter: "FFL",
  spark_plug: "SPK",
  brake_pad: "BPD",
  brake_disc: "BDC",
  brake_fluid: "BFL",
  coolant: "CLT",
  fork_oil: "FKO",
  chain: "CHN",
  sprocket: "SPR",
  chain_lube: "CLB",
  chain_clean: "CCL",
  tyre: "TYR",
  tube: "TUB",
  battery: "BAT",
  bulb: "ELC",
  cable: "CBL",
  bearing: "BRG",
  gasket: "GSK",
  belt: "BLT",
  clutch: "CLU",
  engine_part: "ENG",
  bodywork: "BDY",
  fastener: "FST",
  consumable: "CON",
  accessory: "ACC",
  part: "PRT",
};

/** Pull a manufacturer code out of free text ("NGK CR9EK" -> "CR9EK"). */
export function extractPartCode(text?: string | null): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  const tokens = t.split(/[\s,/()]+/).filter(Boolean);
  for (const raw of tokens) {
    const tok = raw.replace(/[^A-Za-z0-9-]/g, "");
    if (tok.length < 3 || tok.length > 16) continue;
    if (!/[0-9]/.test(tok) || !/[A-Za-z]/.test(tok)) continue;
    if (/^\d+(w|W)-?\d+$/.test(tok)) continue; // 10W-40 is a grade, not a code
    if (/^(dot\d|\d+ml|\d+l|\d+mm|\d+cc|\d+x\d+)$/i.test(tok)) continue;
    return tok.toUpperCase();
  }
  return null;
}

function hash4(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 10000;
  return String(h).padStart(4, "0");
}

/** The code shown in the ITEM column. Always returns something. */
export function derivePartNumber(input: {
  name?: string | null;
  sku?: string | null;
  part_number?: string | null;
  brand?: string | null;
  category?: string | null;
}): string {
  const explicit = (input.part_number ?? input.sku ?? "").trim();
  if (explicit) return explicit.toUpperCase();

  const name = (input.name ?? "").trim();
  const code = extractPartCode(name);
  const brand = (input.brand ?? "").trim();
  const brandTag = brand ? brand.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() : "";
  if (code) return brandTag && !code.startsWith(brandTag) ? `${brandTag} ${code}` : code;

  const cat = (input.category ?? "").trim() || guessInventoryCategory(name);
  return `${PREFIX[cat] ?? "PRT"}-${hash4(name.toLowerCase() || cat)}`;
}

/** The plain-English text shown in the DESCRIPTION column. */
export function derivePartDescription(input: {
  name?: string | null;
  description?: string | null;
  supplier?: string | null;
  category?: string | null;
}): string {
  const existing = (input.description ?? "").trim();
  if (existing) return existing;
  const name = (input.name ?? "").trim();
  const code = extractPartCode(name);
  const stripped = code
    ? name
        .replace(new RegExp(code, "i"), "")
        .replace(/\s{2,}/g, " ")
        .trim()
    : name;
  if (stripped) return stripped;
  const supplier = (input.supplier ?? "").trim();
  if (supplier) return supplier;
  return categoryLabel(input.category ?? guessInventoryCategory(name));
}

/** Item + description pair for any part-like record. */
export function partDisplay(input: {
  name?: string | null;
  sku?: string | null;
  part_number?: string | null;
  brand?: string | null;
  supplier?: string | null;
  description?: string | null;
  category?: string | null;
}) {
  return {
    item: derivePartNumber(input),
    description: derivePartDescription(input),
  };
}
