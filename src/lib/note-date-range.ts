/** Every yyyy-mm-dd date from start to end (inclusive); weekdaysOnly skips Sat/Sun. */
export function noteDateRange(start: string, end: string, weekdaysOnly: boolean): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (isNaN(d.getTime()) || isNaN(last.getTime()) || d > last) return out;
  while (d <= last && out.length < 366) {
    const dow = d.getUTCDay();
    if (!weekdaysOnly || (dow !== 0 && dow !== 6)) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
