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
  let out = capitalise(applyReplacements(tidySpacing(line)));
  if (out && !/[.!?:]$/.test(out)) out += ".";
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
    for (const sentence of sentences.length ? sentences : [line]) chunks.push(sentence);
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
