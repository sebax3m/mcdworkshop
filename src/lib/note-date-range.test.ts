import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { noteDateRange } from "./note-date-range";

describe("note date range", () => {
  test("weekdays only skips the weekend", () => {
    assert.deepEqual(noteDateRange("2026-11-20", "2026-11-24", true), ["2026-11-20", "2026-11-23", "2026-11-24"]);
  });
  test("all days includes the weekend", () => {
    assert.equal(noteDateRange("2026-11-20", "2026-11-24", false).length, 5);
  });
  test("end before start gives nothing", () => {
    assert.deepEqual(noteDateRange("2026-11-24", "2026-11-20", false), []);
  });
});
