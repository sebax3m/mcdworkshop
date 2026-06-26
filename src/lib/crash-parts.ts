// Common crash-repair parts catalog with rough NZD estimates and recommended
// labour hours by damage severity (R&R = remove & refit, paint blend extra).
// Prices are placeholders — edit per claim after quoting suppliers.

export type DamageLevel = "minor" | "moderate" | "severe";

export type CrashPart = {
  id: string;
  name: string;
  category: "Fairings" | "Controls" | "Bars & Levers" | "Wheels & Tyres" | "Tank & Seat" | "Lights" | "Exhaust" | "Frame & Pegs" | "Mirrors";
  estPrice: number;     // NZD ex GST, OEM-ish ballpark
  labourHrs: { minor: number; moderate: number; severe: number }; // R&R / repair hours
};

export const CRASH_PARTS: CrashPart[] = [
  // Fairings
  { id: "fair-lh-upper", name: "LH upper fairing panel OEM", category: "Fairings", estPrice: 650, labourHrs: { minor: 0.5, moderate: 1.5, severe: 3 } },
  { id: "fair-rh-upper", name: "RH upper fairing panel OEM", category: "Fairings", estPrice: 650, labourHrs: { minor: 0.5, moderate: 1.5, severe: 3 } },
  { id: "fair-lh-lower", name: "LH lower fairing / belly OEM", category: "Fairings", estPrice: 580, labourHrs: { minor: 0.5, moderate: 1.2, severe: 2.5 } },
  { id: "fair-rh-lower", name: "RH lower fairing / belly OEM", category: "Fairings", estPrice: 580, labourHrs: { minor: 0.5, moderate: 1.2, severe: 2.5 } },
  { id: "fair-front-nose", name: "Front nose / headlight fairing", category: "Fairings", estPrice: 720, labourHrs: { minor: 0.8, moderate: 2, severe: 3.5 } },
  { id: "fair-tail", name: "Tail / rear seat cowl", category: "Fairings", estPrice: 420, labourHrs: { minor: 0.5, moderate: 1, severe: 2 } },
  { id: "fair-front-fender", name: "Front mudguard / fender", category: "Fairings", estPrice: 220, labourHrs: { minor: 0.3, moderate: 0.6, severe: 1 } },
  { id: "fair-rear-hugger", name: "Rear hugger / inner guard", category: "Fairings", estPrice: 180, labourHrs: { minor: 0.3, moderate: 0.6, severe: 1 } },
  { id: "fair-screen", name: "Windscreen / bubble screen", category: "Fairings", estPrice: 160, labourHrs: { minor: 0.2, moderate: 0.4, severe: 0.6 } },

  // Tank & Seat
  { id: "tank", name: "Fuel tank OEM", category: "Tank & Seat", estPrice: 1450, labourHrs: { minor: 0.8, moderate: 1.5, severe: 2.5 } },
  { id: "tank-pad", name: "Tank pad / protector", category: "Tank & Seat", estPrice: 60, labourHrs: { minor: 0.1, moderate: 0.2, severe: 0.2 } },
  { id: "seat-rider", name: "Rider seat", category: "Tank & Seat", estPrice: 280, labourHrs: { minor: 0.1, moderate: 0.3, severe: 0.5 } },
  { id: "seat-pillion", name: "Pillion seat", category: "Tank & Seat", estPrice: 180, labourHrs: { minor: 0.1, moderate: 0.2, severe: 0.4 } },

  // Bars & Levers
  { id: "bar-clip-lh", name: "LH clip-on / handlebar", category: "Bars & Levers", estPrice: 240, labourHrs: { minor: 0.4, moderate: 0.8, severe: 1.2 } },
  { id: "bar-clip-rh", name: "RH clip-on / handlebar", category: "Bars & Levers", estPrice: 240, labourHrs: { minor: 0.4, moderate: 0.8, severe: 1.2 } },
  { id: "lever-clutch", name: "Clutch lever", category: "Bars & Levers", estPrice: 95, labourHrs: { minor: 0.2, moderate: 0.3, severe: 0.5 } },
  { id: "lever-brake", name: "Front brake lever", category: "Bars & Levers", estPrice: 95, labourHrs: { minor: 0.2, moderate: 0.3, severe: 0.5 } },
  { id: "grip-set", name: "Handlebar grips (pair)", category: "Bars & Levers", estPrice: 55, labourHrs: { minor: 0.2, moderate: 0.3, severe: 0.4 } },
  { id: "bar-end", name: "Bar end weight", category: "Bars & Levers", estPrice: 45, labourHrs: { minor: 0.1, moderate: 0.2, severe: 0.3 } },

  // Controls
  { id: "ctrl-throttle", name: "Throttle tube / assembly", category: "Controls", estPrice: 180, labourHrs: { minor: 0.3, moderate: 0.6, severe: 1 } },
  { id: "ctrl-switch-lh", name: "LH switch block", category: "Controls", estPrice: 320, labourHrs: { minor: 0.3, moderate: 0.7, severe: 1.2 } },
  { id: "ctrl-switch-rh", name: "RH switch block", category: "Controls", estPrice: 320, labourHrs: { minor: 0.3, moderate: 0.7, severe: 1.2 } },
  { id: "ctrl-mc-front", name: "Front brake master cylinder", category: "Controls", estPrice: 380, labourHrs: { minor: 0.4, moderate: 0.8, severe: 1.5 } },
  { id: "ctrl-mc-clutch", name: "Clutch master cylinder", category: "Controls", estPrice: 280, labourHrs: { minor: 0.4, moderate: 0.8, severe: 1.5 } },
  { id: "ctrl-shift", name: "Gear shift lever / linkage", category: "Controls", estPrice: 140, labourHrs: { minor: 0.3, moderate: 0.6, severe: 1 } },
  { id: "ctrl-brake-pedal", name: "Rear brake pedal", category: "Controls", estPrice: 160, labourHrs: { minor: 0.3, moderate: 0.6, severe: 1 } },

  // Mirrors
  { id: "mirror-lh", name: "LH mirror", category: "Mirrors", estPrice: 120, labourHrs: { minor: 0.2, moderate: 0.3, severe: 0.5 } },
  { id: "mirror-rh", name: "RH mirror", category: "Mirrors", estPrice: 120, labourHrs: { minor: 0.2, moderate: 0.3, severe: 0.5 } },

  // Lights
  { id: "light-head", name: "Headlight assembly", category: "Lights", estPrice: 680, labourHrs: { minor: 0.5, moderate: 1, severe: 2 } },
  { id: "light-tail", name: "Tail light assembly", category: "Lights", estPrice: 220, labourHrs: { minor: 0.3, moderate: 0.6, severe: 1 } },
  { id: "light-ind-f", name: "Front indicator (each)", category: "Lights", estPrice: 70, labourHrs: { minor: 0.2, moderate: 0.3, severe: 0.5 } },
  { id: "light-ind-r", name: "Rear indicator (each)", category: "Lights", estPrice: 70, labourHrs: { minor: 0.2, moderate: 0.3, severe: 0.5 } },

  // Wheels & Tyres
  { id: "wheel-front", name: "Front wheel OEM", category: "Wheels & Tyres", estPrice: 1200, labourHrs: { minor: 0.8, moderate: 1.5, severe: 2.5 } },
  { id: "wheel-rear", name: "Rear wheel OEM", category: "Wheels & Tyres", estPrice: 1400, labourHrs: { minor: 1, moderate: 1.8, severe: 3 } },
  { id: "tyre-front", name: "Front tyre", category: "Wheels & Tyres", estPrice: 280, labourHrs: { minor: 0.5, moderate: 0.8, severe: 1 } },
  { id: "tyre-rear", name: "Rear tyre", category: "Wheels & Tyres", estPrice: 360, labourHrs: { minor: 0.6, moderate: 0.9, severe: 1.2 } },
  { id: "disc-front", name: "Front brake disc", category: "Wheels & Tyres", estPrice: 320, labourHrs: { minor: 0.4, moderate: 0.7, severe: 1.2 } },
  { id: "disc-rear", name: "Rear brake disc", category: "Wheels & Tyres", estPrice: 280, labourHrs: { minor: 0.4, moderate: 0.7, severe: 1.2 } },

  // Frame & Pegs
  { id: "peg-lh", name: "LH footpeg / hanger", category: "Frame & Pegs", estPrice: 180, labourHrs: { minor: 0.3, moderate: 0.6, severe: 1 } },
  { id: "peg-rh", name: "RH footpeg / hanger", category: "Frame & Pegs", estPrice: 180, labourHrs: { minor: 0.3, moderate: 0.6, severe: 1 } },
  { id: "frame-slider", name: "Frame slider (each)", category: "Frame & Pegs", estPrice: 95, labourHrs: { minor: 0.2, moderate: 0.4, severe: 0.6 } },
  { id: "subframe", name: "Subframe (rear)", category: "Frame & Pegs", estPrice: 950, labourHrs: { minor: 1, moderate: 2.5, severe: 5 } },
  { id: "swingarm", name: "Swingarm", category: "Frame & Pegs", estPrice: 1600, labourHrs: { minor: 1.5, moderate: 3, severe: 6 } },
  { id: "fork-tube", name: "Fork tube (each)", category: "Frame & Pegs", estPrice: 850, labourHrs: { minor: 1, moderate: 2, severe: 4 } },

  // Exhaust
  { id: "exh-muffler", name: "Muffler / can", category: "Exhaust", estPrice: 780, labourHrs: { minor: 0.4, moderate: 0.8, severe: 1.5 } },
  { id: "exh-header", name: "Header / midpipe", category: "Exhaust", estPrice: 650, labourHrs: { minor: 0.6, moderate: 1.2, severe: 2.5 } },
];

export const PART_CATEGORIES = Array.from(new Set(CRASH_PARTS.map((p) => p.category)));

// Generic labour bundles by damage level (paint, R&R bundles, etc.)
export const LABOUR_PRESETS: { id: string; name: string; hrs: number }[] = [
  { id: "lab-paint-single", name: "Paint single panel (incl. prep)", hrs: 3 },
  { id: "lab-paint-blend", name: "Paint blend into adjacent panel", hrs: 2 },
  { id: "lab-strip-rebuild", name: "Strip & rebuild fairings", hrs: 2.5 },
  { id: "lab-alignment", name: "Wheel alignment / geometry check", hrs: 1 },
  { id: "lab-diagnostic", name: "Post-crash diagnostic / road test", hrs: 1 },
  { id: "lab-cleanup", name: "Detail / wash post-repair", hrs: 0.5 },
];
