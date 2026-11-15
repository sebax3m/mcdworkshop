/** Notes store an event time (e.g. doctor appointment) as a " @ HH:MM" suffix in the title. */
export function splitNoteTitle(title: string): { label: string; eventTime: string | null } {
  const m = title.match(/^(.*?)\s*@\s*(\d{1,2}:\d{2})\s*$/);
  return m ? { label: m[1], eventTime: m[2] } : { label: title, eventTime: null };
}
export function joinNoteTitle(label: string, eventTime: string | null): string {
  const l = label.trim();
  return eventTime ? `${l} @ ${eventTime}` : l;
}
/** "14:30" -> "2:30 PM" */
export function formatEventTime12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}
