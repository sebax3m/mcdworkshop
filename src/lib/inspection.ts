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
  draft: { label: "Draft", chip: "bg-muted text-muted-foreground border-border" },
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

/** Quick-add templates shown to technicians. */
export const FINDING_PRESETS: { title: string; category: FindingCategory; severity: Severity }[] = [
  { title: "Chain & sprockets worn", category: "chain_sprockets", severity: "important" },
  { title: "Front brake pads low", category: "brakes", severity: "safety_critical" },
  { title: "Rear brake pads low", category: "brakes", severity: "safety_critical" },
  { title: "Rear tyre near wear limit", category: "tyres", severity: "recommended" },
  { title: "Front tyre near wear limit", category: "tyres", severity: "recommended" },
  { title: "Fork seals leaking", category: "suspension", severity: "important" },
  { title: "Coolant low / due for change", category: "cooling", severity: "recommended" },
  { title: "Battery weak", category: "electrical", severity: "recommended" },
  { title: "Steering head bearing worn", category: "safety", severity: "safety_critical" },
];
