import { test } from "node:test";
import { strict as assert } from "node:assert";
import { joinNoteTitle, splitNoteTitle } from "./note-event-time";
test("doctor appointment time round-trips", () => {
  const t = joinNoteTitle("Shaun — Doctor Appointment", "14:30");
  assert.deepEqual(splitNoteTitle(t), { label: "Shaun — Doctor Appointment", eventTime: "14:30" });
  assert.equal(splitNoteTitle("Holidays").eventTime, null);
});
