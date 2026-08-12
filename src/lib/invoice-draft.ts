/**
 * Smart Invoice Draft — Phase 1.
 *
 * Pure, deterministic mapping from recorded Job Card data to suggested invoice
 * lines. No AI, no invented prices: anything without a recorded price is
 * flagged `PRICE REQUIRED` for a human to fill in before the invoice is created.
 */

export const LABOUR_RATE = 130; // NZD per hour, GST inclusive
export const GST_RATE = 0.15;

export type DraftKind = "labour" | "part" | "fluid" | "other";

export type DraftLine = {
  id: string;
  kind: DraftKind;
  item_code: string;
  item_name: string;
  description: string;
  quantity: number;
  unit: number; // price per unit, GST inclusive
  discount_pct: number;
  /** Where this line came from — shown in the review screen. */
  source: string;
  /** True when no recorded price exists and a human must enter one. */
  price_required: boolean;
};

export type DraftWarning = {
  level: "ok" | "warn" | "error";
  text: string;
};

export type DetectedWork = {
  label: string;
  detail?: string;
  origin: string;
};

export type EstimateDiff = {
  label: string;
  estimateHours: number;
  actualHours: number;
};

export type JobDraftInput = {
  job: {
    id: string;
    job_number: number;
    title: string | null;
    description: string | null;
    complaint: string | null;
    estimated_hours: number | null;
    status: string;
  };
  tasks: Array<{ id: string; label: string; is_done: boolean; note: string | null }>;
  parts: Array<{
    id: string;
    name: string;
    quantity: number;
    retail: number | null;
    cost: number | null;
    discount_pct: number;
    on_invoice: boolean;
    supplier: string | null;
  }>;
  findings: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string;
    severity: string;
    recommended_action: string | null;
    estimated_labour: number | null;
    estimated_parts_cost: number | null;
    status: string;
  }>;
  trackedMinutes: number;
  notes: Array<{ id: string; body: string; author_name?: string; created_at: string }>;
};

const FLUID_WORDS = [
  "oil",
  "fluid",
  "coolant",
  "grease",
  "lube",
  "lubricant",
  "cleaner",
  "degreaser",
  "additive",
];

export function isFluidName(name: string): boolean {
  const n = name.toLowerCase();
  // Hard parts that merely mention a fluid word (oil filter, oil seal…) stay parts.
  if (/(filter|seal|pump|cooler|line|hose|cap|tank|gasket)/.test(n)) return false;
  return FLUID_WORDS.some((w) => n.includes(w)) || n.includes("motocool");
}

function uid(prefix: string, i: number) {
  return `${prefix}-${i}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function lineTotal(l: DraftLine): number {
  return round2(l.unit * l.quantity * (1 - (l.discount_pct || 0) / 100));
}

export function draftTotals(lines: DraftLine[]) {
  const total = round2(lines.reduce((s, l) => s + lineTotal(l), 0));
  const gst = round2((total * GST_RATE) / (1 + GST_RATE));
  return { total, gst, exGst: round2(total - gst) };
}

/** Findings that were actually approved by the customer. */
export function approvedFindings(input: JobDraftInput) {
  return input.findings.filter((f) => f.status === "approved");
}

export function declinedFindings(input: JobDraftInput) {
  return input.findings.filter((f) => f.status === "declined" || f.status === "deferred");
}

export function openFindings(input: JobDraftInput) {
  return input.findings.filter(
    (f) => !["approved", "declined", "deferred"].includes(f.status),
  );
}

/** Build the editable invoice draft from recorded job data. */
export function buildInvoiceDraft(input: JobDraftInput): {
  lines: DraftLine[];
  detected: DetectedWork[];
  warnings: DraftWarning[];
  diffs: EstimateDiff[];
} {
  const lines: DraftLine[] = [];
  const detected: DetectedWork[] = [];
  const warnings: DraftWarning[] = [];
  const diffs: EstimateDiff[] = [];

  const trackedHours = round2(input.trackedMinutes / 60);
  const estHours = Number(input.job.estimated_hours ?? 0);

  // ── Base labour for the booked service ─────────────────────────────────
  const baseHours = estHours > 0 ? estHours : trackedHours;
  if (baseHours > 0) {
    lines.push({
      id: uid("labour", 0),
      kind: "labour",
      item_code: "LAB",
      item_name: input.job.title || "Workshop labour",
      description: `Labour — ${baseHours} h @ $${LABOUR_RATE}/h`,
      quantity: baseHours,
      unit: LABOUR_RATE,
      discount_pct: 0,
      source: estHours > 0 ? "Job estimate" : "Technician tracked time",
      price_required: false,
    });
  } else {
    warnings.push({ level: "warn", text: "No estimated hours or tracked time on this job." });
  }

  if (estHours > 0 && trackedHours > 0 && Math.abs(trackedHours - estHours) >= 0.25) {
    diffs.push({ label: input.job.title || "Booked service", estimateHours: estHours, actualHours: trackedHours });
    warnings.push({
      level: "warn",
      text: `Tracked time (${trackedHours} h) differs from the estimate (${estHours} h) by ${
        trackedHours > estHours ? "+" : ""
      }${round2(trackedHours - estHours)} h.`,
    });
  }

  // ── Completed tasks → detected work ────────────────────────────────────
  input.tasks
    .filter((t) => t.is_done)
    .forEach((t) =>
      detected.push({ label: t.label, detail: t.note ?? undefined, origin: "Job task completed" }),
    );
  const openTasks = input.tasks.filter((t) => !t.is_done);
  if (openTasks.length) {
    warnings.push({
      level: "warn",
      text: `${openTasks.length} job task${openTasks.length > 1 ? "s are" : " is"} still open.`,
    });
  }

  // ── Approved additional work (inspection findings) ─────────────────────
  approvedFindings(input).forEach((f, i) => {
    detected.push({
      label: f.title,
      detail: f.recommended_action ?? f.description ?? undefined,
      origin: "Approved additional work",
    });
    const hrs = Number(f.estimated_labour ?? 0);
    if (hrs > 0) {
      lines.push({
        id: uid("finding-lab", i),
        kind: "labour",
        item_code: "LAB",
        item_name: f.title,
        description: `Additional approved labour — ${hrs} h @ $${LABOUR_RATE}/h`,
        quantity: hrs,
        unit: LABOUR_RATE,
        discount_pct: 0,
        source: "Approved inspection finding",
        price_required: false,
      });
    }
    const partsCost = Number(f.estimated_parts_cost ?? 0);
    if (partsCost > 0) {
      lines.push({
        id: uid("finding-part", i),
        kind: "part",
        item_code: "",
        item_name: `${f.title} — parts`,
        description: f.recommended_action ?? "",
        quantity: 1,
        unit: partsCost,
        discount_pct: 0,
        source: "Approved inspection finding (quoted parts)",
        price_required: false,
      });
    }
    if (hrs === 0 && partsCost === 0) {
      warnings.push({
        level: "warn",
        text: `Approved work "${f.title}" has no quoted labour or parts — price required.`,
      });
      lines.push({
        id: uid("finding-empty", i),
        kind: "other",
        item_code: "",
        item_name: f.title,
        description: f.recommended_action ?? f.description ?? "",
        quantity: 1,
        unit: 0,
        discount_pct: 0,
        source: "Approved inspection finding",
        price_required: true,
      });
    }
  });

  openFindings(input).forEach((f) => {
    warnings.push({
      level: "warn",
      text: `Finding "${f.title}" is not approved — not billed unless authorised.`,
    });
  });

  // ── Parts & fluids actually used ───────────────────────────────────────
  input.parts
    .filter((p) => p.on_invoice !== false)
    .forEach((p, i) => {
      const price = Number(p.retail ?? 0);
      const fluid = isFluidName(p.name);
      detected.push({
        label: `${p.name} × ${p.quantity}`,
        origin: fluid ? "Fluid used" : "Part used",
      });
      lines.push({
        id: uid(fluid ? "fluid" : "part", i),
        kind: fluid ? "fluid" : "part",
        item_code: "",
        item_name: p.name,
        description: p.supplier ? `Supplier: ${p.supplier}` : "",
        quantity: Number(p.quantity ?? 1),
        unit: price,
        discount_pct: Number(p.discount_pct ?? 0),
        source: "Parts used on job",
        price_required: price <= 0,
      });
      if (price <= 0) {
        warnings.push({ level: "error", text: `PRICE REQUIRED — ${p.name}` });
      }
    });

  if (!lines.length) {
    warnings.push({ level: "error", text: "No billable work recorded on this job yet." });
  }
  if (input.job.status !== "completed") {
    warnings.push({ level: "warn", text: "Job is not marked as completed." });
  }
  if (!warnings.some((w) => w.level === "error")) {
    warnings.unshift({ level: "ok", text: "All detected work has a recorded price." });
  }

  return { lines, detected, warnings, diffs };
}

/** Structured, source-of-truth payload handed to the report writer. */
export function buildReportFacts(
  input: JobDraftInput,
  bike: { make?: string | null; model?: string | null; year?: number | null; rego?: string | null },
) {
  return {
    bike: `${bike.year ?? ""} ${bike.make ?? ""} ${bike.model ?? ""}`.trim(),
    rego: bike.rego ?? "",
    job_title: input.job.title ?? "",
    customer_complaint: input.job.complaint ?? "",
    work_completed: input.tasks.filter((t) => t.is_done).map((t) => t.label),
    work_not_completed: input.tasks.filter((t) => !t.is_done).map((t) => t.label),
    parts_and_fluids_used: input.parts.map((p) => `${p.name} × ${p.quantity}`),
    inspection_findings: input.findings.map((f) => ({
      title: f.title,
      severity: f.severity,
      status: f.status,
      recommendation: f.recommended_action ?? f.description ?? "",
    })),
    additional_work_completed: approvedFindings(input).map((f) => f.title),
    declined_or_deferred: declinedFindings(input).map((f) => f.title),
    technician_notes: input.notes.map((n) => n.body),
  };
}

/** Deterministic (no-AI) fallback report built straight from the facts. */
export function buildPlainReport(facts: ReturnType<typeof buildReportFacts>): string {
  const s: string[] = [];
  const bullet = (arr: string[]) => arr.map((x) => `• ${x}`).join("\n");

  s.push("WORK COMPLETED");
  s.push(facts.work_completed.length ? bullet(facts.work_completed) : "• No tasks recorded.");

  const findings = facts.inspection_findings.filter((f) => f.status !== "approved");
  if (findings.length) {
    s.push("\nINSPECTION FINDINGS");
    s.push(bullet(findings.map((f) => `${f.title}${f.recommendation ? ` — ${f.recommendation}` : ""}`)));
  }
  if (facts.additional_work_completed.length) {
    s.push("\nADDITIONAL WORK COMPLETED");
    s.push(bullet(facts.additional_work_completed));
  }
  if (facts.declined_or_deferred.length) {
    s.push("\nDECLINED / DEFERRED WORK");
    s.push(bullet(facts.declined_or_deferred));
  }
  const recs = facts.inspection_findings
    .filter((f) => f.recommendation && f.status !== "approved")
    .map((f) => f.recommendation);
  if (recs.length) {
    s.push("\nRECOMMENDATIONS");
    s.push(bullet(recs));
  }
  if (facts.technician_notes.length) {
    s.push("\nTECHNICIAN NOTES");
    s.push(bullet(facts.technician_notes));
  }
  return s.join("\n");
}
