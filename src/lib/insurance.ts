export type ClaimStatus =
  | "intake"
  | "assessing"
  | "quote_in_progress"
  | "quote_sent"
  | "approved"
  | "declined"
  | "waiting_parts"
  | "in_repair"
  | "ready_for_pickup"
  | "closed";

export const CLAIM_PIPELINE: ClaimStatus[] = [
  "intake",
  "assessing",
  "quote_in_progress",
  "quote_sent",
  "approved",
  "waiting_parts",
  "in_repair",
  "ready_for_pickup",
  "closed",
];

export const CLAIM_STATUS_META: Record<ClaimStatus, { label: string; cls: string; short: string }> = {
  intake:            { label: "Intake",              short: "Intake",     cls: "border-border bg-muted text-foreground" },
  assessing:         { label: "Assessing damage",    short: "Assessing",  cls: "border-status-progress/40 bg-status-progress/10 text-status-progress" },
  quote_in_progress: { label: "Quote in progress",   short: "Quoting",    cls: "border-status-progress/40 bg-status-progress/10 text-status-progress" },
  quote_sent:        { label: "Quote sent",          short: "Sent",       cls: "border-status-parts/40 bg-status-parts/10 text-status-parts" },
  approved:          { label: "Approved by insurer", short: "Approved",   cls: "border-status-ready/40 bg-status-ready/10 text-status-ready" },
  declined:          { label: "Declined / negotiating", short: "Declined",cls: "border-destructive/40 bg-destructive/10 text-destructive" },
  waiting_parts:     { label: "Waiting for parts",   short: "Parts",      cls: "border-status-parts/40 bg-status-parts/10 text-status-parts" },
  in_repair:         { label: "In repair",           short: "Repair",     cls: "border-primary/40 bg-primary/10 text-primary" },
  ready_for_pickup:  { label: "Ready for pickup",    short: "Ready",      cls: "border-status-ready/40 bg-status-ready/10 text-status-ready" },
  closed:            { label: "Closed / invoiced",   short: "Closed",     cls: "border-border bg-muted text-muted-foreground" },
};

export function claimStatusLabel(s: string | null | undefined) {
  if (!s) return "—";
  return CLAIM_STATUS_META[s as ClaimStatus]?.label ?? s;
}

export function nextStatus(s: ClaimStatus): ClaimStatus | null {
  const i = CLAIM_PIPELINE.indexOf(s);
  if (i < 0 || i >= CLAIM_PIPELINE.length - 1) return null;
  return CLAIM_PIPELINE[i + 1];
}
