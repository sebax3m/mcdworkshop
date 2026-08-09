/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The Data API caps every response at 1000 rows regardless of the requested
 * range, so large tables (garage, customers) silently truncate. This helper
 * pages through the table until a short page comes back.
 */
export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => any,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 200; page++) {
    const from = page * pageSize;
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}
