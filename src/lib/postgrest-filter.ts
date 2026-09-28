/**
 * Builds a safe, quoted `%term%` value for PostgREST `.or()` ilike filters.
 * Quoting + escaping prevents commas/parentheses/dots in user input from
 * altering the filter expression (filter injection).
 */
export function ilikeValue(raw: string): string {
  const cleaned = raw
    .trim()
    .slice(0, 200)
    .replace(/[\\%_]/g, (c) => `\\${c}`)
    .replace(/"/g, '\\"');
  return `"%${cleaned}%"`;
}
