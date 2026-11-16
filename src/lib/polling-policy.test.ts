import { test } from "node:test";
import { strict as assert } from "node:assert";
import { isForeground, CLOCK_POLL_MS, NOTIFICATION_POLL_MS, AUTO_CLOCK_OUT_POLL_MS } from "./polling-policy";

test("database polling stops in hidden tabs", () => assert.equal(isForeground(false, true), false));
test("database polling stops in unfocused windows", () => assert.equal(isForeground(true, false), false));
test("database polling resumes in visible focused windows", () => assert.equal(isForeground(true, true), true));
test("clock queries use 30 seconds", () => assert.equal(CLOCK_POLL_MS, 30_000));
test("notifications use 60 seconds", () => assert.equal(NOTIFICATION_POLL_MS, 60_000));
test("clock-out recovery uses 60 seconds", () => assert.equal(AUTO_CLOCK_OUT_POLL_MS, 60_000));