/* Parts Reminder — suggestion engine shared by Quick Booking (calendar) and New Booking.
 * Reminders are suggestions only: nothing is ordered until an item is marked "to_order".
 */

export type ReminderStatus =
  | "suggested"
  | "check_first"
  | "required"
  | "to_order"
  | "in_stock";

export type ReminderSource = "service_template" | "instructions" | "manual" | "history";

export const REMINDER_STATUSES: { key: ReminderStatus; label: string; cls: string }[] = [
  { key: "suggested", label: "Suggested", cls: "border-border bg-muted/60 text-muted-foreground" },
  { key: "check_first", label: "Check first", cls: "border-yellow-500/60 bg-yellow-500/10 text-yellow-300" },
  { key: "required", label: "Required", cls: "border-orange-500/60 bg-orange-500/15 text-orange-300" },
  { key: "to_order", label: "To order", cls: "border-red-500/60 bg-red-500/15 text-red-300" },
  { key: "in_stock", label: "In stock", cls: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300" },
];

export const reminderStatusMeta = (s: string) =>
  REMINDER_STATUSES.find((x) => x.key === s) ?? REMINDER_STATUSES[0];

export type ReminderItem = {
  key: string;
  description: string;
  status: ReminderStatus;
  source: ReminderSource;
  selected: boolean;
  /** true once the user changed the status / checked it — never auto-removed on refresh */
  touched: boolean;
};

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

let uid = 0;
export const reminderKey = () => `r${Date.now().toString(36)}-${uid++}`;

export type Suggestion = { description: string; source: ReminderSource };

/** Reusable per-service recommended-parts templates (extensible). */
const SERVICE_RULES: { match: RegExp; parts: string[] }[] = [
  { match: /full\s*service|major\s*service/, parts: ["Engine Oil", "Oil Filter", "Air Filter", "Spark Plugs"] },
  {
    match: /standard\s*service|oil\s*(&|\band\s+)?filter|oil\s*change|minor\s*service|interim\s*service/,
    parts: ["Engine Oil", "Oil Filter"],
  },
  { match: /brake/, parts: ["Brake Pads", "Brake Fluid"] },
  { match: /chain|sprocket/, parts: ["Chain", "Front Sprocket", "Rear Sprocket"] },
  { match: /tyre|tire/, parts: ["Tyres"] },
  { match: /valve\s*(clearance|adjust|shim)/, parts: ["Valve Cover Gasket"] },
  { match: /coolant/, parts: ["Coolant"] },
  { match: /battery/, parts: ["Battery"] },
];

/** Keyword rules over the Instructions field. */
export function suggestFromInstructions(text: string): Suggestion[] {
  const t = (text ?? "").toLowerCase();
  const out: string[] = [];
  const push = (p: string) => {
    if (!out.some((x) => norm(x) === norm(p))) out.push(p);
  };
  const pads = /\bfront\s+(brake|pads?)\b/.test(t)
    ? "Front Brake Pads"
    : /\brear\s+(brake|pads?)\b/.test(t)
      ? "Rear Brake Pads"
      : /brake\s*pads?\b|\bpads\b/.test(t)
        ? "Brake Pads"
        : null;
  if (pads) {
    push(pads);
    // Pad replacement almost always pairs with a fluid check/bleed — remind it too.
    push("Brake Fluid");
  }
  if (/brake\s+fluid|\bbleed\b/.test(t)) push("Brake Fluid");

  if (/brake\s*(rotor|disc)/.test(t)) push("Brake Rotors");
  if (/\bchain\b/.test(t)) push("Chain");
  if (/sprockets?/.test(t)) {
    push("Front Sprocket");
    push("Rear Sprocket");
  }
  if (/\btyres?\b|\btires?\b/.test(t)) push("Tyres");
  if (/\bbattery\b/.test(t)) push("Battery");
  if (/fork\s*seals?/.test(t)) push("Fork Seals");
  if (/clutch/.test(t)) push("Clutch Cable");
  if (/spark\s*plugs?/.test(t)) push("Spark Plugs");
  if (/air\s*filter/.test(t)) push("Air Filter");
  if (/oil\s*filter/.test(t)) push("Oil Filter");
  if (/\boil\b/.test(t)) push("Engine Oil");
  if (/coolant/.test(t)) push("Coolant");
  return out.map((description) => ({ description, source: "instructions" as const }));
}

/** Suggestions for a booking: service template first, then instructions. Deduped. */
export function buildSuggestions(
  serviceType: string,
  serviceTypeOther: string,
  instructions: string,
): Suggestion[] {
  const svc = `${serviceType ?? ""} ${serviceTypeOther ?? ""}`.toLowerCase();
  const out: Suggestion[] = [];
  const push = (s: Suggestion) => {
    if (!out.some((x) => norm(x.description) === norm(s.description))) out.push(s);
  };
  for (const rule of SERVICE_RULES) {
    if (rule.match.test(svc)) {
      for (const p of rule.parts) push({ description: p, source: "service_template" });
    }
  }
  for (const s of suggestFromInstructions(instructions)) push(s);
  return out;
}

/** Merge a fresh suggestion set into the current items without losing user input. */
export function mergeSuggestions(items: ReminderItem[], suggestions: Suggestion[]): ReminderItem[] {
  const wanted = new Set(suggestions.map((s) => norm(s.description)));
  const kept = items.filter(
    (it) => it.source === "manual" || it.touched || it.selected || wanted.has(norm(it.description)),
  );
  const have = new Set(kept.map((it) => norm(it.description)));
  const added = suggestions
    .filter((s) => !have.has(norm(s.description)))
    .map<ReminderItem>((s) => ({
      key: reminderKey(),
      description: s.description,
      status: "suggested",
      source: s.source,
      selected: false,
      touched: false,
    }));
  return [...kept, ...added];
}
