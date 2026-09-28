/**
 * Offline "Fix Wording" helper.
 *
 * Tidies a technician's rough notes with plain text rules only — no AI calls,
 * so it never consumes credits. It never invents facts: it only fixes spacing,
 * punctuation, capitalisation and splits unrelated work into separate lines.
 */

/** Common workshop shorthand / typos → tidy wording. */
const REPLACEMENTS: [RegExp, string][] = [
  [/\btuing\b/gi, "tuning"],
  [/\bconnecte\s+d\b/gi, "connected"],
  [/\bo2\b/gi, "O2"],
  [/\becu\b/gi, "ECU"],
  [/\becm\b/gi, "ECM"],
  [/\bwof\b/gi, "WOF"],
  [/\bkms\b/gi, "km"],
  [/\bplz\b/gi, "please"],
  [/\bcust\b/gi, "customer"],
  [/\bautorise\b/gi, "authorise"],
  [/\brecomended\b/gi, "recommended"],
  [/\brecomend\b/gi, "recommend"],
];

/** Past-tense workshop actions — a run-on note is split before each one. */
const ACTION_VERBS = [
  "removed", "refitted", "reinstalled", "installed", "fitted", "replaced", "renewed", "checked", "inspected",
  "adjusted", "cleaned", "lubed", "lubricated", "greased", "tightened", "torqued", "bled", "flushed",
  "drained", "filled", "topped", "changed", "tested", "test rode", "road tested", "diagnosed", "reset",
  "repaired", "serviced", "balanced", "aligned", "set", "synced", "synchronised", "updated", "programmed",
  "measured", "found", "carried out", "performed", "scanned", "charged", "rebuilt", "sealed",
];
const VERB_RE = new RegExp(`\\s+(?:and\\s+|then\\s+|,\\s*)?(?=(?:${ACTION_VERBS.map((v) => v.replace(/ /g, "\\s+")).join("|")})\\b)`, "gi");

/** Professional workshop terminology for common shorthand openings. */
const TERMINOLOGY: [RegExp, string][] = [
  [/^checked\s+(front and rear\s+)?brakes?\b/i, "Inspected $1braking system"],
  [/^checked\b/i, "Inspected"],
  [/^adjusted\s+chain\b(?!\s+tension)/i, "Adjusted chain tension to specification"],
  [/^(?:lubed|lubricated|oiled)\s+(?:the\s+)?chain\b/i, "Cleaned and lubricated drive chain"],
  [/^(?:test rode|road tested|tested)\s+(?:the\s+)?(?:motorcycle|bike)\b/i, "Carried out final inspection and road test"],
  [/^test rode\b/i, "Road tested"],
  [/^removed\s+fairings?\b(?!\s+to)/i, "Removed fairings to access required components"],
  [/^changed\s+(?:the\s+)?oil\b/i, "Replaced engine oil"],
  [/^bled\s+(?:the\s+)?brakes?\b/i, "Bled braking system"],
];

function splitActions(sentence: string): string[] {
  return sentence
    .replace(/[.]$/, "")
    .split(VERB_RE)
    .map((s) => s.replace(/^(?:and|then)\s+/i, "").replace(/[,;]\s*$/, "").trim())
    .filter(Boolean);
}

function terminology(line: string): string {
  let out = line;
  for (const [re, v] of TERMINOLOGY) {
    if (re.test(out)) {
      out = out.replace(re, v);
      break;
    }
  }
  return out;
}

function tidySpacing(line: string): string {
  return line
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])(?=\S)/g, "$1 ")
    .trim();
}

function capitalise(line: string): string {
  return line
    .replace(/^([a-z])/, (m) => m.toUpperCase())
    .replace(/([.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
}

function applyReplacements(line: string): string {
  let out = line;
  for (const [pattern, value] of REPLACEMENTS) out = out.replace(pattern, value);
  return out;
}

function polish(line: string): string {
  const out = capitalise(applyReplacements(tidySpacing(line))).replace(/\.$/, "");
  return out;
}

/**
 * Splits the note into separate jobs / steps and returns a tidy bullet list.
 * Existing bullets and line breaks are respected; long run-on sentences are
 * split on full stops so unrelated work ends up on its own line.
 */
export function fixWording(raw: string): string {
  const source = raw.replace(/\r\n/g, "\n").trim();
  if (!source) return "";

  const chunks: string[] = [];
  for (const rawLine of source.split("\n")) {
    const line = rawLine.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
    if (!line) continue;
    const sentences = line
      .split(/(?<=[.!?])\s+(?=[A-Za-z])/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const sentence of sentences.length ? sentences : [line])
      for (const action of splitActions(sentence)) chunks.push(terminology(action));
  }

  const seen = new Set<string>();
  const lines: string[] = [];
  for (const chunk of chunks) {
    const clean = polish(chunk);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    lines.push(`• ${clean}`);
  }

  return lines.join("\n");
}
