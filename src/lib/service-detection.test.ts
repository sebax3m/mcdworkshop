import { test, expect } from "bun:test";
import { promotedService } from "./service-detection";

test("job 310 notes promote Diagnostic to Annual Service", () => {
  expect(promotedService("Diagnostic", "- Service\n- WOF\nAnnual service $395\nChain 149 +75")).toBe("Annual Service");
});
test("never overrides a non-Diagnostic service", () => {
  expect(promotedService("Tuning", "Annual service $395")).toBeNull();
});
test("declined mention is ignored", () => {
  expect(promotedService("Diagnostic", "Customer declined full service")).toBeNull();
});
test("full service beats annual", () => {
  expect(promotedService("Diagnostic", "annual service\nfull service quote")).toBe("Full Service");
});
