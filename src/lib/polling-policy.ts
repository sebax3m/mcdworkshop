export const CLOCK_POLL_MS = 30_000;
export const NOTIFICATION_POLL_MS = 60_000;
export const AUTO_CLOCK_OUT_POLL_MS = 60_000;

export function isForeground(visible: boolean, focused: boolean): boolean {
  return visible && focused;
}