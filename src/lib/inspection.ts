/** Shared constants + helpers for the inspection → approval workflow. */

export const FINDING_CATEGORIES = [
  "brakes",
  "chain_sprockets",
  "tyres",
  "suspension",
  "electrical",
  "engine",
  "cooling",
  "transmission",
  "service_item",
  "safety",
  "other",
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<string, string> = {
  brakes: "Brakes",
  chain_sprockets: "Chain / Sprockets",
  tyres: "Tyres",
  suspension: "Suspension",
  electrical: "Electrical",
  engine: "Engine",
  cooling: "Cooling",
  transmission: "Transmission",
  service_item: "Service item",
  safety: "Safety",
  other: "Other",
};

export const SEVERITIES = ["information", "recommended", "important", "safety_critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_META: Record<string, { label: string; chip: string; dot: string }> = {
  information: {
    label: "Information",
    chip: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  recommended: {
    label: "Recommended",
    chip: "bg-blue-500/15 text-blue-400 border-blue-500/40",
    dot: "bg-blue-500",
  },
  important: {
    label: "Important",
    chip: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    dot: "bg-amber-500",
  },
  safety_critical: {
    label: "Safety critical",
    chip: "bg-destructive/15 text-destructive border-destructive/40",
    dot: "bg-destructive",
  },
};

export const FINDING_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "declined",
  "deferred",
] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const FINDING_STATUS_META: Record<string, { label: string; chip: string }> = {
  draft: { label: "New", chip: "bg-muted text-muted-foreground border-border" },
  pending_approval: {
    label: "Awaiting approval",
    chip: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  },
  approved: { label: "Approved", chip: "bg-green-500/15 text-green-400 border-green-500/40" },
  declined: { label: "Declined", chip: "bg-destructive/15 text-destructive border-destructive/40" },
  deferred: { label: "Deferred", chip: "bg-blue-500/15 text-blue-400 border-blue-500/40" },
};

export const CONTACT_METHODS = ["phone", "sms", "email", "in_person", "other"] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const CONTACT_METHOD_LABEL: Record<string, string> = {
  phone: "Phone",
  sms: "SMS",
  email: "Email",
  in_person: "In person",
  other: "Other",
};

export type InspectionFinding = {
  id: string;
  job_id: string;
  approval_request_id: string | null;
  title: string;
  description: string | null;
  category: string;
  severity: string;
  recommended_action: string | null;
  estimated_labour: number | null;
  estimated_parts_cost: number | null;
  photo_path: string | null;
  status: string;
  decision_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ApprovalRequest = {
  id: string;
  job_id: string;
  requested_by: string | null;
  requested_at: string;
  status: string;
  decision: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  customer_contact_method: string | null;
  resolution_note: string | null;
};

/** Workshop labour rate (GST inclusive) used for inspection quote estimates. */
export const INSPECTION_LABOUR_RATE = 130;

/** Quick-add templates shown to technicians. Each preset carries its own
 *  labour + parts estimate that is only applied when the technician explicitly
 *  taps the preset; new blank findings start with no defaults. */
export const FINDING_PRESETS: {
  title: string;
  category: FindingCategory;
  severity: Severity;
  labour: number;
  parts: number;
  action?: string;
}[] = [
  {
    title: "Chain & sprockets worn",
    category: "chain_sprockets",
    severity: "important",
    labour: 1.5,
    parts: 320,
    action: "Replace chain and sprocket kit.",
  },
  {
    title: "Front brake pads low",
    category: "brakes",
    severity: "safety_critical",
    labour: 1,
    parts: 55,
    action: "Replace front brake pads.",
  },
  {
    title: "Rear brake pads low",
    category: "brakes",
    severity: "safety_critical",
    labour: 1,
    parts: 45,
    action: "Replace rear brake pads.",
  },
  {
    title: "Brake fluid change",
    category: "brakes",
    severity: "recommended",
    labour: 1,
    parts: 35,
    action: "Flush and bleed brake system.",
  },
  {
    title: "Brake discs worn",
    category: "brakes",
    severity: "important",
    labour: 1.5,
    parts: 320,
    action: "Replace brake disc(s).",
  },
  {
    title: "Rear tyre near wear limit",
    category: "tyres",
    severity: "recommended",
    labour: 1,
    parts: 360,
    action: "Replace rear tyre.",
  },
  {
    title: "Front tyre near wear limit",
    category: "tyres",
    severity: "recommended",
    labour: 0.8,
    parts: 280,
    action: "Replace front tyre.",
  },
  {
    title: "Fork seals leaking",
    category: "suspension",
    severity: "important",
    labour: 3,
    parts: 180,
    action: "Replace fork seals and oil.",
  },
  {
    title: "Rear shock worn",
    category: "suspension",
    severity: "recommended",
    labour: 2,
    parts: 550,
    action: "Replace or service rear shock.",
  },
  {
    title: "Coolant low / due for change",
    category: "cooling",
    severity: "recommended",
    labour: 1,
    parts: 45,
    action: "Drain and refill coolant.",
  },
  {
    title: "Battery weak",
    category: "electrical",
    severity: "recommended",
    labour: 0.5,
    parts: 180,
    action: "Replace battery.",
  },
  {
    title: "Steering head bearing worn",
    category: "safety",
    severity: "safety_critical",
    labour: 2.5,
    parts: 100,
    action: "Replace steering head bearings and re-torque.",
  },
  {
    title: "Wheel bearings worn",
    category: "safety",
    severity: "important",
    labour: 1.5,
    parts: 120,
    action: "Replace wheel bearings.",
  },
  {
    title: "Clutch slipping",
    category: "transmission",
    severity: "important",
    labour: 2.5,
    parts: 350,
    action: "Replace clutch plates and springs.",
  },
  {
    title: "Air filter dirty",
    category: "service_item",
    severity: "recommended",
    labour: 0.5,
    parts: 70,
    action: "Replace air filter.",
  },
  {
    title: "Spark plugs due",
    category: "service_item",
    severity: "recommended",
    labour: 1,
    parts: 90,
    action: "Replace spark plugs.",
  },
  {
    title: "Oil leak",
    category: "engine",
    severity: "important",
    labour: 2,
    parts: 150,
    action: "Trace leak, replace gasket/seal.",
  },
  {
    title: "Valve clearances out of spec",
    category: "engine",
    severity: "important",
    labour: 4,
    parts: 180,
    action: "Adjust valve clearances / fit shims.",
  },
];

/** Quote roll-up for a list of findings. All amounts are GST-inclusive;
 *  `gst` is the embedded 15% component and `subtotal` is the ex-GST value. */
export function quoteTotals(list: { estimated_labour: number | null; estimated_parts_cost: number | null }[]) {
  const hours = list.reduce((n, f) => n + (Number(f.estimated_labour) || 0), 0);
  const parts = list.reduce((n, f) => n + (Number(f.estimated_parts_cost) || 0), 0);
  const labour = hours * INSPECTION_LABOUR_RATE;
  const total = labour + parts;
  const gst = (total * 0.15) / 1.15;
  return { hours, parts, labour, subtotal: total - gst, gst, total };
}

