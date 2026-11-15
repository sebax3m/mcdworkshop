import { test } from "node:test";
import { strict as assert } from "node:assert";
import { joinNoteTitle, splitNoteTitle } from "./note-event-time";
test("doctor appointment time round-trips", () => {
  const t = joinNoteTitle("Shaun — Doctor Appointment", "14:30");
  assert.deepEqual(splitNoteTitle(t), { label: "Shaun — Doctor Appointment", eventTime: "14:30" });
  assert.equal(splitNoteTitle("Holidays").eventTime, null);
});
import { formatEventTime12 } from "./note-event-time";
test("shows AM/PM", () => {
  assert.equal(formatEventTime12("14:30"), "2:30 PM");
  assert.equal(formatEventTime12("09:05"), "9:05 AM");
  assert.equal(formatEventTime12("00:15"), "12:15 AM");
  assert.equal(formatEventTime12("12:00"), "12:00 PM");
});
