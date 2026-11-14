import { isBookInCompleted, type BookInLike } from "./book-in-status";

type CalendarBooking = BookInLike & {
  id: string;
  drop_off_time?: string | null;
  created_at?: string | null;
};
type CalendarItem = { id: string; time: string; booking: CalendarBooking | null };

export function compareCalendarBookings(a: CalendarBooking, b: CalendarBooking) {
  return Number(isBookInCompleted(a)) - Number(isBookInCompleted(b)) ||
    String(a.drop_off_time ?? "23:59:59").localeCompare(String(b.drop_off_time ?? "23:59:59")) ||
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")) ||
    a.id.localeCompare(b.id);
}

/** Notes remain time-ordered among active work; completed cards stay last. */
export function compareCalendarDayItems(a: CalendarItem, b: CalendarItem) {
  return Number(isBookInCompleted(a.booking)) - Number(isBookInCompleted(b.booking)) ||
    a.time.localeCompare(b.time) ||
    (a.booking && b.booking ? compareCalendarBookings(a.booking, b.booking) : a.id.localeCompare(b.id));
}

/** Convert a visible drop boundary to an index in the remaining active bookings. */
export function activeBookingDropIndex(items: CalendarItem[], index: number, draggedId: string) {
  return items.slice(0, index).filter((item) =>
    item.booking && item.id !== draggedId && !isBookInCompleted(item.booking),
  ).length;
}

/** Only active bookings receive new slots; completed history is never restamped. */
export function reorderActiveCalendarBookings<T extends CalendarBooking>(list: T[], current: T, index: number): T[] {
  const others = list.filter((b) => b.id !== current.id && !isBookInCompleted(b)).sort(compareCalendarBookings);
  if (isBookInCompleted(current)) return others;
  const position = Math.max(0, Math.min(index, others.length));
  return [...others.slice(0, position), current, ...others.slice(position)];
}