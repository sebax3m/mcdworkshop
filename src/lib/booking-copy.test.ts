import { test } from "node:test";
import { strict as assert } from "node:assert";
import { bookingCopySeed } from "./booking-copy";
const source = { customer_id: "customer", motorcycle_id: "bike", service_type: "Full Service", estimated_hours: 4, notes: "Check brakes", instructions: "Check valves" };
test("duplicate reuses customer, bike, service and instructions", () => {
  assert.deepEqual(bookingCopySeed(source, false), { customerId: "customer", bikeId: "bike", service: "Full Service", serviceOther: "", estimatedHours: "4", notes: "Check brakes\nCheck valves" });
});
test("another motorcycle keeps customer but clears bike-specific instructions and identity", () => {
  const copy = bookingCopySeed(source, true);
  assert.equal(copy.customerId, "customer");
  assert.equal(copy.bikeId, null);
  assert.equal(copy.notes, "");
});