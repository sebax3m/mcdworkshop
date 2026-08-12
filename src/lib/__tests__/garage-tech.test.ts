import { describe, expect, it } from "vitest";
import {
  buildTechPreview,
  missingKnowledge,
  parseTechImport,
  resolveImportVerification,
  type TechSpec,
} from "@/lib/garage-tech";

const models = [
  { id: "m1", make: "Yamaha", model: "MT-09", generation: "Gen 3", variant: null, engine: null, platform: "CP3", category: null, priority: 1, market_status: null, year_from: 2021, year_to: 2023 },
  { id: "m2", make: "Yamaha", model: "MT-09", generation: "Gen 4", variant: null, engine: null, platform: "CP3", category: null, priority: 1, market_status: null, year_from: 2024, year_to: null },
];

const csv = `make,model,generation,year_from,year_to,category,subject,field,value,unit,source_type,source_name,source_ref,source_date,verification
Yamaha,MT-09,Gen 3,2021,2023,engine_oil,,oil_viscosity,10W-40,,manufacturer_document,Service Manual,SM-1,2021-01-01,manufacturer_verified
Yamaha,MT-09,Gen 3,2021,2023,torque,Front axle,torque,65,Nm,external_research,Forum,,,manufacturer_verified
Yamaha,MT-09,Gen 3,2021,2023,valves,,intake_min,0.10,mm,workshop_manual,Manual,SM-1,2021-01-01,workshop_verified
Yamaha,MT-09,Gen 3,2021,2023,filters,Oil filter,oem_part,5GH-13440-70,,supplier,Partmaster,INV-1,2024-02-01,supplier_verified
Honda,CB500,,2020,,engine_oil,,oil_viscosity,10W-30,,manual_entry,,,,unverified`;

const existing: TechSpec[] = [
  {
    id: "s1", model_id: "m1", category: "torque", subject: "Front axle", field: "torque", value_text: "60", value_num: 60,
    unit: "Nm", notes: null, source_type: "workshop_manual", source_name: "Manual", source_ref: null, source_date: null,
    verification: "workshop_verified", verified_by: null, verified_at: null, is_alternative: false, review_status: "ok",
    import_batch: null, is_archived: false, updated_at: new Date().toISOString(),
  },
];

describe("garage tech phase 3", () => {
  const rows = parseTechImport(csv);

  it("parses csv", () => {
    expect(rows).toHaveLength(5);
    expect(rows[0].field).toBe("oil_viscosity");
  });

  it("keeps untrusted safety-critical values unverified", () => {
    expect(resolveImportVerification(rows[1])).toBe("unverified");
    expect(resolveImportVerification(rows[0])).toBe("manufacturer_verified");
    expect(resolveImportVerification(rows[2])).toBe("workshop_verified");
    expect(resolveImportVerification(rows[3])).toBe("supplier_verified");
  });

  it("matches exact generation and flags conflicts", () => {
    const preview = buildTechPreview(rows, models, existing);
    expect(preview[0].status).toBe("new");
    expect(preview[0].modelId).toBe("m1");
    const conflict = preview[1];
    expect(conflict.status).toBe("conflict");
    expect(conflict.existing?.value_num).toBe(60);
    expect(conflict.resolution).toBe("review");
    expect(preview[4].status).toBe("invalid"); // unknown model
  });

  it("reports missing knowledge", () => {
    const m = missingKnowledge(existing);
    expect(m.find((x) => x.label === "Front axle torque")?.present).toBe(true);
    expect(m.find((x) => x.label === "Fork oil grade")?.present).toBe(false);
  });
});
