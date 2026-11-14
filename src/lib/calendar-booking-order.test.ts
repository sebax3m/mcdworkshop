import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { activeBookingDropIndex, compareCalendarDayItems, reorderActiveCalendarBookings } from "./calendar-booking-order";

const a = { id: "A", status: "completed", drop_off_time: "08:00:00" };
const b = { id: "B", status: "booked", drop_off_time: "08:15:00" };
const c = { id: "C", status: "booked", drop_off_time: "08:30:00" };
const item = (booking: typeof a) => ({ id: booking.id, time: booking.drop_off_time, booking });

describe("calendar booking drop order", () => {
  test("completed A at 08:00 stays after active B and C", () => {
    assert.deepEqual([a, b, c].map(item).sort(compareCalendarDayItems).map((i) => i.id), ["B", "C", "A"]);
  });
  test("dropping C above B places C before B and never assigns A a new slot", () => {
    const items = [a, b, c].map(item).sort(compareCalendarDayItems);
    const result = reorderActiveCalendarBookings([a, b, c], c, activeBookingDropIndex(items, 0, c.id));
    assert.deepEqual(result.map((i) => i.id), ["C", "B"]);
    assert.equal(a.drop_off_time, "08:00:00");
  });
  test("downward drops exclude the dragged card from the insertion index", () => {
    const items = [b, c, a].map(item);
    assert.equal(activeBookingDropIndex(items, 2, b.id), 1);
    assert.deepEqual(reorderActiveCalendarBookings([a, b, c], b, activeBookingDropIndex(items, 2, b.id)).map((i) => i.id), ["C", "B"]);
  });
  test("notes and completed cards do not consume active booking drop slots", () => {
    const note = { id: "note", time: "08:20:00", booking: null };
    const items = [item(b), note, item(c), item(a)];
    assert.equal(activeBookingDropIndex(items, 4, "from-another-day"), 2);
    assert.equal(activeBookingDropIndex(items.slice(0, 3), 3, "from-another-day"), 2);
  });
  test("notes stay between active bookings even when a finished booking has an earlier time", () => {
    const note = { id: "note", time: "08:20:00", booking: null };
    assert.deepEqual([item(a), item(c), note, item(b)].sort(compareCalendarDayItems).map((i) => i.id), ["B", "note", "C", "A"]);
  });
});