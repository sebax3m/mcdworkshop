/** Place a note between visible calendar items without changing booking times. */
export function calendarNoteTime(before?: string | null, after?: string | null): string {
  const seconds = (time: string) => {
    const [h, m, s = 0] = time.split(":").map(Number);
    return h * 3600 + m * 60 + s;
  };
  const start = before ? seconds(before) : 0;
  const end = after ? seconds(after) : 86399;
  const value = Math.max(0, Math.min(86399, Math.floor((start + end) / 2)));
  return [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60]
    .map((n) => String(n).padStart(2, "0")).join(":");
}