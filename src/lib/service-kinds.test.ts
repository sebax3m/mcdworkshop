import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { HARLEY_INDIAN_LICENSE_PRICE, powerVisionDynoCharge, tunePartNumberForMake, tunePriceForMake } from "./service-kinds";

describe("Harley and Indian prices from invoice 01149", () => {
  test("Power Vision licence costs $550 GST inclusive", () => {
    assert.equal(HARLEY_INDIAN_LICENSE_PRICE, 550);
  });
  test("the $1,200 package leaves a $650 Dyno charge", () => {
    assert.equal(powerVisionDynoCharge(1200), 650);
  });
  test("Harley-Davidson keeps the $1,200 package", () => {
    assert.equal(tunePriceForMake("Harley-Davidson"), 1200);
  });
  test("Indian uses the $1,200 Harley/Indian package", () => {
    assert.equal(tunePriceForMake("Indian"), 1200);
    assert.equal(tunePartNumberForMake("Indian"), "DYNOHD");
  });
  test("other motorcycle makes keep the $950 default", () => {
    assert.equal(tunePriceForMake("Honda"), 950);
    assert.equal(tunePartNumberForMake("Honda"), "DYNO");
  });
});