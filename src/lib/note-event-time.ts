/** Notes store an event time (e.g. doctor appointment) as a " @ HH:MM" suffix in the title. */
export function splitNoteTitle(title: string): { label: string; eventTime: string | null } {
  const m = title.match(/^(.*?)\s*@\s*(\d{1,2}:\d{2})\s*$/);
  return m ? { label: m[1], eventTime: m[2] } : { label: title, eventTime: null };
}
export function joinNoteTitle(label: string, eventTime: string | null): string {
  const l = label.trim();
  return eventTime ? `${l} @ ${eventTime}` : l;
}
