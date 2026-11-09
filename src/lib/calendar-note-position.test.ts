import { describe, expect, test } from "bun:test";
import { calendarNoteTime } from "./calendar-note-position";

describe("calendar note placement", () => {
  test("places a note between book-ins without changing their times", () => {
    expect(calendarNoteTime("08:00:00", "08:15:00")).toBe("08:07:30");
  });
  test("allows positions before the first and after the last book-in", () => {
    expect(calendarNoteTime(null, "08:00:00")).toBe("04:00:00");
    expect(calendarNoteTime("08:15:00", null)).toBe("16:07:29");
  });
});