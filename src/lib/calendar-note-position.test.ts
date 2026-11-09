import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { calendarNoteTime } from "./calendar-note-position";

describe("calendar note placement", () => {
  test("places a note between book-ins without changing their times", () => {
    assert.equal(calendarNoteTime("08:00:00", "08:15:00"), "08:07:30");
  });
  test("allows positions before the first and after the last book-in", () => {
    assert.equal(calendarNoteTime(null, "08:00:00"), "04:00:00");
    assert.equal(calendarNoteTime("08:15:00", null), "16:07:29");
  });
});