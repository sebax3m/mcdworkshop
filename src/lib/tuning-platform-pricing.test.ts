import { test } from "node:test";
import { strict as assert } from "node:assert";
import { powerVisionLicenceSplit } from "./tuning-platform-pricing";

const dyno = (retail: number) => [{ id: "dyno", part_number: "DYNOHD", retail, quantity: 1 }];
for (const platform of ["woolich", "alientech", "tuneecu", null]) {
  test(`${platform ?? "clear"} preserves a manually priced $950 tune`, () => {
    assert.equal(powerVisionLicenceSplit(platform, "Harley-Davidson", dyno(950)), null);
  });
}
test("$500 Power Vision retune receives no new licence", () => {
  assert.equal(powerVisionLicenceSplit("powervision", "Harley-Davidson", dyno(500)), null);
});
test("explicit retune receives no licence even above $750", () => {
  assert.equal(powerVisionLicenceSplit("powervision", "Indian", dyno(1000), "Retune"), null);
});
test("$1,200 Indian tune splits into $650 Dyno and $550 licence", () => {
  assert.deepEqual(powerVisionLicenceSplit("powervision", "Indian", dyno(1200)), { dynoId: "dyno", dynoRetail: 650, licenceRetail: 550 });
});
test("manual $1,400 package total is preserved", () => {
  assert.equal(powerVisionLicenceSplit("powervision", "Harley-Davidson", dyno(1400))?.dynoRetail, 850);
});
test("existing manually priced licence and Dyno are left untouched", () => {
  assert.equal(powerVisionLicenceSplit("powervision", "Indian", [...dyno(650), { id: "licence", part_number: "PV-LICENSE", retail: 550, quantity: 1 }]), null);
});
test("Power Vision on Japanese bikes is tracking only", () => {
  assert.equal(powerVisionLicenceSplit("powervision", "Honda", dyno(950)), null);
});
test("selecting a platform does not create billing when no tune exists", () => {
  assert.equal(powerVisionLicenceSplit("powervision", "Indian", []), null);
});