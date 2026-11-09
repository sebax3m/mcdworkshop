// Detects the booked service from free-text book-in notes/instructions.
// Only used to promote generic "Diagnostic" bookings to the real service.

const RULES: { service: string; re: RegExp }[] = [
  { service: "Full Service", re: /\bfull\s+service\b|\bmajor\s+service\b/ },
  { service: "Annual Service", re: /\bannual\s+service\b/ },
  { service: "Standard Service", re: /\bstandard\s+service\b/ },
  { service: "Basic Service", re: /\b(basic|eco|minor)\s+service\b/ },
  { service: "Tuning", re: /\bdyno\s+tun|\bcustom\s+tune\b|\btuning\b|power\s?vision|woolich|alientech/ },
];

const NEGATION = /\b(no|not|declined?|without|skip(ped)?|cancel(led)?)\b/;

export const DETECTABLE_FROM = ["diagnostic", ""];

export function detectServiceFromText(text: string | null | undefined): string | null {
  const lines = (text ?? "").toLowerCase().split(/\r?\n/);
  for (const rule of RULES) {
    if (lines.some((l) => rule.re.test(l) && !NEGATION.test(l))) return rule.service;
  }
  return null;
}

/** Returns the new service when the current one is generic Diagnostic and the text names a real service. */
export function promotedService(current: string | null | undefined, ...texts: (string | null | undefined)[]): string | null {
  if (!DETECTABLE_FROM.includes((current ?? "").trim().toLowerCase())) return null;
  return detectServiceFromText(texts.filter(Boolean).join("\n"));
}
