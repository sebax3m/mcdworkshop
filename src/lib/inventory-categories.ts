/** Shared inventory categories + smart auto-categorisation from an item name. */

export interface InventoryCategory {
  key: string;
  label: string;
  /** Default unit suggested when a new item lands in this category. */
  unit: string;
}

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  { key: "oil", label: "Engine oil", unit: "L" },
  { key: "oil_filter", label: "Oil filters", unit: "unit" },
  { key: "air_filter", label: "Air filters", unit: "unit" },
  { key: "fuel_filter", label: "Fuel filters", unit: "unit" },
  { key: "spark_plug", label: "Spark plugs", unit: "unit" },
  { key: "brake_pad", label: "Brake pads", unit: "set" },
  { key: "brake_disc", label: "Brake discs", unit: "unit" },
  { key: "brake_fluid", label: "Brake fluid", unit: "bottle" },
  { key: "coolant", label: "Coolant", unit: "L" },
  { key: "fork_oil", label: "Fork oil", unit: "L" },
  { key: "chain", label: "Chains", unit: "unit" },
  { key: "sprocket", label: "Sprockets", unit: "unit" },
  { key: "chain_lube", label: "Chain lube", unit: "can" },
  { key: "chain_clean", label: "Chain cleaner", unit: "can" },
  { key: "tyre", label: "Tyres", unit: "unit" },
  { key: "tube", label: "Tubes / valves", unit: "unit" },
  { key: "battery", label: "Batteries", unit: "unit" },
  { key: "bulb", label: "Bulbs / electrical", unit: "unit" },
  { key: "cable", label: "Cables", unit: "unit" },
  { key: "bearing", label: "Bearings / seals", unit: "unit" },
  { key: "gasket", label: "Gaskets / o-rings", unit: "unit" },
  { key: "belt", label: "Belts", unit: "unit" },
  { key: "clutch", label: "Clutch parts", unit: "unit" },
  { key: "engine_part", label: "Engine parts", unit: "unit" },
  { key: "bodywork", label: "Bodywork / crash protection", unit: "unit" },
  { key: "fastener", label: "Fasteners / hardware", unit: "unit" },
  { key: "consumable", label: "Workshop consumables", unit: "unit" },
  { key: "accessory", label: "Accessories", unit: "unit" },
  { key: "part", label: "Other parts", unit: "unit" },
];

export function categoryLabel(key?: string | null): string {
  if (!key) return "Uncategorised";
  return (
    INVENTORY_CATEGORIES.find((c) => c.key === key)?.label ??
    key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
  );
}

export function categoryUnit(key?: string | null): string {
  return INVENTORY_CATEGORIES.find((c) => c.key === key)?.unit ?? "unit";
}

/** Ordered rules — first match wins. */
const RULES: Array<[string, RegExp]> = [
  ["oil_filter", /\boil\s*filter\b|\bhf\s?\d{2,4}\b|\bhiflo\s?hf\d/i],
  ["air_filter", /\bair\s*filter\b|\bhfa\d|\bk&?n\b.*filter/i],
  ["fuel_filter", /\bfuel\s*filter\b/i],
  ["spark_plug", /\bspark\s*plug\b|\bplug\b.*\bngk\b|\bngk\b|\bdenso\b|\biridium\b/i],
  ["brake_pad", /\bbrake\s*pad|\bpads?\b.*\bbrake\b|\bsintered\s*pad/i],
  ["brake_disc", /\bbrake\s*(disc|rotor)\b|\brotor\b/i],
  ["brake_fluid", /\bbrake\s*fluid\b|\bdot\s*[3-9](\.\d)?\b|\brbf\s?\d{3}\b/i],
  ["coolant", /\bcoolant\b|\bmotocool\b|\binugel\b|\bantifreeze\b/i],
  ["fork_oil", /\bfork\s*oil\b|\bsuspension\s*fluid\b/i],
  ["chain_lube", /\bchain\s*(lube|lubricant|wax)\b/i],
  ["chain_clean", /\bchain\s*(clean|cleaner|degrease)/i],
  ["chain", /\bchain\b.*\b(\d{3}[a-z]*|x-?ring|o-?ring)\b|\bdid\b|\brk\s?\d{3}/i],
  ["sprocket", /\bsprocket\b|\bfront\s*\/?\s*rear\s*gear\b/i],
  ["tyre", /\btyre\b|\btire\b|\bpirelli\b|\bmichelin\b|\bdunlop\b|\bbridgestone\b/i],
  ["tube", /\binner\s*tube\b|\bvalve\s*stem\b|\brim\s*tape\b/i],
  ["battery", /\bbattery\b|\byuasa\b|\bytx\d/i],
  ["bulb", /\bbulb\b|\bheadlight\b|\bindicator\b|\bled\b|\bfuse\b|\brelay\b|\bcoil\b|\bstator\b|\bregulator\b|\bsensor\b/i],
  ["cable", /\bcable\b|\bthrottle\s*wire\b|\bclutch\s*line\b|\bbrake\s*line\b|\bhose\b/i],
  ["bearing", /\bbearing\b|\bseal\b|\bbush(ing)?\b|\bcirclip\b/i],
  ["gasket", /\bgasket\b|\bo-?ring\b|\bcrush\s*washer\b|\bsump\s*(plug|washer)\b/i],
  ["belt", /\bbelt\b/i],
  ["clutch", /\bclutch\b/i],
  ["engine_part", /\bpiston\b|\bvalve\b|\bcam\b|\btensioner\b|\bwater\s*pump\b|\binjector\b|\bcylinder\b/i],
  ["bodywork", /\bslider\b|\bcrash\b|\bfairing\b|\bmirror\b|\blever\b|\bguard\b|\bscreen\b/i],
  ["fastener", /\bbolt\b|\bnut\b|\bscrew\b|\bwasher\b|\bclip\b|\bzip\s*tie\b/i],
  ["consumable", /\bconsumable\b|\bcleaner\b|\bdegreaser\b|\bcontact\b|\bgrease\b|\bsilicone\b|\brag\b|\bwd-?40\b|\bloctite\b/i],
  ["oil", /\b\d{1,2}w-?\d{2}\b|\bengine\s*oil\b|\b(5100|7100|300v|3000|710)\b|\bmotor\s*oil\b/i],
];

/** Best-guess category for an item name (falls back to generic parts). */
export function guessInventoryCategory(name: string): string {
  const n = (name ?? "").trim();
  if (!n) return "part";
  for (const [key, re] of RULES) if (re.test(n)) return key;
  return "part";
}
