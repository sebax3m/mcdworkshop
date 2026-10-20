import { describe, expect, test } from "bun:test";
import { HARLEY_INDIAN_LICENSE_PRICE, powerVisionDynoCharge, tunePartNumberForMake, tunePriceForMake } from "./service-kinds";

describe("Harley and Indian prices from invoice 01149", () => {
  test("Power Vision licence costs $550 GST inclusive", () => {
    expect(HARLEY_INDIAN_LICENSE_PRICE).toBe(550);
  });
  test("the $1,200 package leaves a $650 Dyno charge", () => {
    expect(powerVisionDynoCharge(1200)).toBe(650);
  });
  test("Harley-Davidson keeps the $1,200 package", () => {
    expect(tunePriceForMake("Harley-Davidson")).toBe(1200);
  });
  test("Indian uses the $1,200 Harley/Indian package", () => {
    expect(tunePriceForMake("Indian")).toBe(1200);
    expect(tunePartNumberForMake("Indian")).toBe("DYNOHD");
  });
  test("other motorcycle makes keep the $950 default", () => {
    expect(tunePriceForMake("Honda")).toBe(950);
    expect(tunePartNumberForMake("Honda")).toBe("DYNO");
  });
});