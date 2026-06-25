// Manufacturer-recommended valve clearance specs (cold engine), in millimetres.
// Curated from official service manuals for the most common bikes seen in NZ
// workshops. When an exact model isn't matched we fall back to a sensible
// per-make default and flag the result as "generic" so the technician knows
// to verify against the manufacturer's manual.

export type ValveSpec = {
  intake: [number, number];
  exhaust: [number, number];
  source: string;     // bike this spec is from, e.g. "Yamaha MT-07 (2014+)"
  generic?: boolean;  // true when we couldn't match the exact model
  note?: string;
};

type Rule = {
  match: (model: string, year?: number | null) => boolean;
  spec: ValveSpec;
};

const RULES: Record<string, Rule[]> = {
  yamaha: [
    { match: (m) => /mt[- ]?07|tenere ?700|xsr ?700|r ?7\b/i.test(m),
      spec: { intake: [0.10, 0.15], exhaust: [0.22, 0.27], source: "Yamaha MT-07 / Ténéré 700 (CP2)" } },
    { match: (m) => /mt[- ]?09|tracer ?9|xsr ?900|niken/i.test(m),
      spec: { intake: [0.11, 0.20], exhaust: [0.21, 0.30], source: "Yamaha MT-09 / Tracer 9 (CP3)" } },
    { match: (m) => /mt[- ]?10|r ?1\b|fz ?10/i.test(m),
      spec: { intake: [0.11, 0.20], exhaust: [0.21, 0.25], source: "Yamaha YZF-R1 / MT-10" } },
    { match: (m) => /r ?6\b|yzf[- ]?r6/i.test(m),
      spec: { intake: [0.13, 0.20], exhaust: [0.20, 0.30], source: "Yamaha YZF-R6" } },
    { match: (m) => /r ?3\b|mt[- ]?03|yzf[- ]?r3/i.test(m),
      spec: { intake: [0.10, 0.15], exhaust: [0.22, 0.27], source: "Yamaha YZF-R3 / MT-03" } },
    { match: () => true,
      spec: { intake: [0.11, 0.20], exhaust: [0.21, 0.30], source: "Yamaha (typical 4-stroke)", generic: true } },
  ],
  honda: [
    { match: (m) => /cbr ?1000|fireblade|sp[- ]?1000/i.test(m),
      spec: { intake: [0.16, 0.22], exhaust: [0.27, 0.33], source: "Honda CBR1000RR Fireblade" } },
    { match: (m) => /cbr ?600|cbr600rr/i.test(m),
      spec: { intake: [0.16, 0.22], exhaust: [0.25, 0.31], source: "Honda CBR600RR" } },
    { match: (m) => /africa ?twin|crf ?1000|crf ?1100|crf1100l/i.test(m),
      spec: { intake: [0.20, 0.24], exhaust: [0.26, 0.30], source: "Honda CRF1000/1100 Africa Twin" } },
    { match: (m) => /cb ?500|cbr ?500|cb ?400 ?f|nx ?500|rebel ?500/i.test(m),
      spec: { intake: [0.14, 0.18], exhaust: [0.23, 0.27], source: "Honda CB500/CBR500 parallel-twin" } },
    { match: (m) => /cb ?650|cbr ?650/i.test(m),
      spec: { intake: [0.16, 0.22], exhaust: [0.22, 0.28], source: "Honda CB650/CBR650" } },
    { match: (m) => /nc ?700|nc ?750|integra/i.test(m),
      spec: { intake: [0.15, 0.19], exhaust: [0.24, 0.28], source: "Honda NC700/750" } },
    { match: (m) => /grom|msx ?125|monkey ?125|cub ?125/i.test(m),
      spec: { intake: [0.16, 0.20], exhaust: [0.16, 0.20], source: "Honda Grom / Monkey 125" } },
    { match: () => true,
      spec: { intake: [0.16, 0.20], exhaust: [0.25, 0.30], source: "Honda (typical 4-stroke)", generic: true } },
  ],
  kawasaki: [
    { match: (m) => /zx[- ]?10|ninja ?1000|z1000/i.test(m),
      spec: { intake: [0.15, 0.24], exhaust: [0.22, 0.31], source: "Kawasaki ZX-10R / Z1000" } },
    { match: (m) => /zx[- ]?6|ninja ?636|zx6r/i.test(m),
      spec: { intake: [0.15, 0.21], exhaust: [0.22, 0.28], source: "Kawasaki ZX-6R" } },
    { match: (m) => /ninja ?650|z650|versys ?650|er[- ]?6/i.test(m),
      spec: { intake: [0.15, 0.24], exhaust: [0.22, 0.31], source: "Kawasaki 649cc parallel-twin" } },
    { match: (m) => /ninja ?400|z400|ninja ?300|z300/i.test(m),
      spec: { intake: [0.15, 0.24], exhaust: [0.22, 0.31], source: "Kawasaki Ninja 300/400" } },
    { match: (m) => /klr ?650|klx/i.test(m),
      spec: { intake: [0.10, 0.20], exhaust: [0.15, 0.25], source: "Kawasaki KLR650 / KLX" } },
    { match: () => true,
      spec: { intake: [0.15, 0.24], exhaust: [0.22, 0.31], source: "Kawasaki (typical 4-stroke)", generic: true } },
  ],
  suzuki: [
    { match: (m) => /gsx[- ]?r ?1000|gsxr1000/i.test(m),
      spec: { intake: [0.10, 0.20], exhaust: [0.20, 0.30], source: "Suzuki GSX-R1000" } },
    { match: (m) => /gsx[- ]?r ?750|gsx[- ]?r ?600/i.test(m),
      spec: { intake: [0.10, 0.20], exhaust: [0.20, 0.30], source: "Suzuki GSX-R600/750" } },
    { match: (m) => /sv ?650|gladius|v[- ]?strom ?650/i.test(m),
      spec: { intake: [0.10, 0.20], exhaust: [0.20, 0.30], source: "Suzuki SV650 / V-Strom 650" } },
    { match: (m) => /v[- ]?strom ?1000|v[- ]?strom ?1050|gsx[- ]?s ?1000|katana/i.test(m),
      spec: { intake: [0.10, 0.20], exhaust: [0.20, 0.30], source: "Suzuki 1000/1050cc V-twin & inline-4" } },
    { match: () => true,
      spec: { intake: [0.10, 0.20], exhaust: [0.20, 0.30], source: "Suzuki (typical 4-stroke)", generic: true } },
  ],
  ducati: [
    { match: (m) => /panigale|streetfighter ?v4|multistrada ?v4|diavel ?v4/i.test(m),
      spec: { intake: [0.10, 0.15], exhaust: [0.20, 0.25], source: "Ducati Desmosedici Stradale V4 (opening)",
        note: "Desmodromic — also check closing clearance per manual." } },
    { match: (m) => /monster|scrambler|hypermotard|multistrada|supersport|panigale ?v2/i.test(m),
      spec: { intake: [0.10, 0.15], exhaust: [0.20, 0.25], source: "Ducati Testastretta L-twin (opening)",
        note: "Desmodromic — also check closing clearance per manual." } },
    { match: () => true,
      spec: { intake: [0.10, 0.15], exhaust: [0.20, 0.25], source: "Ducati (desmo, opening)", generic: true,
        note: "Desmodromic — confirm closing clearance per manual." } },
  ],
  bmw: [
    { match: (m) => /s ?1000 ?rr|s ?1000 ?r|s ?1000 ?xr|m ?1000/i.test(m),
      spec: { intake: [0.13, 0.18], exhaust: [0.25, 0.30], source: "BMW S1000RR / S1000R" } },
    { match: (m) => /r ?1250|r ?1200|r ?1300|gs(\s|$)|rt(\s|$)/i.test(m),
      spec: { intake: [0.15, 0.20], exhaust: [0.30, 0.35], source: "BMW R 1200/1250/1300 boxer (ShiftCam)" } },
    { match: (m) => /f ?850|f ?900|f ?750/i.test(m),
      spec: { intake: [0.13, 0.18], exhaust: [0.25, 0.30], source: "BMW F 750/850/900" } },
    { match: () => true,
      spec: { intake: [0.15, 0.20], exhaust: [0.30, 0.35], source: "BMW (typical)", generic: true } },
  ],
  ktm: [
    { match: (m) => /390|rc ?390|duke ?390|adventure ?390/i.test(m),
      spec: { intake: [0.10, 0.15], exhaust: [0.20, 0.25], source: "KTM 390 LC4c" } },
    { match: (m) => /690|smc ?r|enduro ?r/i.test(m),
      spec: { intake: [0.10, 0.15], exhaust: [0.20, 0.25], source: "KTM 690 LC4" } },
    { match: (m) => /790|890/i.test(m),
      spec: { intake: [0.10, 0.15], exhaust: [0.20, 0.25], source: "KTM 790/890 LC8c" } },
    { match: (m) => /1190|1290|super ?duke|super ?adventure/i.test(m),
      spec: { intake: [0.10, 0.15], exhaust: [0.20, 0.25], source: "KTM 1190/1290 LC8 V-twin" } },
    { match: () => true,
      spec: { intake: [0.10, 0.15], exhaust: [0.20, 0.25], source: "KTM (typical LC4/LC8)", generic: true } },
  ],
  triumph: [
    { match: (m) => /street ?triple|daytona ?675|daytona ?765|trident ?660|tiger ?660|speed ?triple/i.test(m),
      spec: { intake: [0.10, 0.20], exhaust: [0.25, 0.35], source: "Triumph 660/675/765/1050/1200 triple" } },
    { match: (m) => /bonneville|t100|t120|thruxton|scrambler ?1200|speedmaster|bobber/i.test(m),
      spec: { intake: [0.10, 0.15], exhaust: [0.15, 0.25], source: "Triumph Bonneville parallel-twin (HT)" } },
    { match: () => true,
      spec: { intake: [0.10, 0.20], exhaust: [0.25, 0.35], source: "Triumph (typical)", generic: true } },
  ],
  aprilia: [
    { match: (m) => /rsv ?4|tuono ?v4/i.test(m),
      spec: { intake: [0.13, 0.20], exhaust: [0.30, 0.37], source: "Aprilia RSV4 / Tuono V4" } },
    { match: () => true,
      spec: { intake: [0.13, 0.20], exhaust: [0.30, 0.37], source: "Aprilia (typical)", generic: true } },
  ],
  harley: [
    { match: () => true,
      spec: { intake: [0.0, 0.0], exhaust: [0.0, 0.0], source: "Harley-Davidson (hydraulic lifters)", generic: true,
        note: "Most modern Harleys use hydraulic lifters — no manual valve adjustment required." } },
  ],
  "harley-davidson": [
    { match: () => true,
      spec: { intake: [0.0, 0.0], exhaust: [0.0, 0.0], source: "Harley-Davidson (hydraulic lifters)", generic: true,
        note: "Most modern Harleys use hydraulic lifters — no manual valve adjustment required." } },
  ],
};

const FALLBACK: ValveSpec = {
  intake: [0.10, 0.20],
  exhaust: [0.20, 0.30],
  source: "Generic 4-stroke fallback",
  generic: true,
  note: "Verify against the manufacturer's service manual before adjusting.",
};

export function getValveSpec(make?: string | null, model?: string | null, year?: number | null): ValveSpec {
  const m = (make ?? "").trim().toLowerCase();
  const mdl = (model ?? "").trim();
  const rules = RULES[m];
  if (!rules) return FALLBACK;
  for (const r of rules) {
    if (r.match(mdl, year ?? undefined)) return r.spec;
  }
  return FALLBACK;
}

export function formatRange(r: [number, number]): string {
  if (r[0] === 0 && r[1] === 0) return "n/a";
  return `${r[0].toFixed(2)}–${r[1].toFixed(2)} mm`;
}
