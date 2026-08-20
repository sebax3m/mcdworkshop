/**
 * ONE central source of truth for Motorcycle Doctors master service templates.
 *
 * The authoritative data lives in the `service_templates` table (name, description,
 * versioned `tasks` list). This module holds the canonical names, aliases and the
 * shared helpers every screen uses so nothing re-implements its own copy.
 *
 * Jobs never read the master template while work is happening: creating a job
 * snapshots the template items into `job_tasks` (with `template_id` /
 * `template_version`), so editing a master template never rewrites history.
 */
import { supabase } from "@/integrations/supabase/client";

export const MASTER_SERVICE_NAMES = [
  "Basic / Eco Service",
  "Standard Service",
  "Annual Service",
  "Full Service",
] as const;

export type MasterServiceName = (typeof MASTER_SERVICE_NAMES)[number];

/** Legacy / free-text names mapped onto the canonical master template names. */
const ALIASES: Record<string, MasterServiceName> = {
  "basic service": "Basic / Eco Service",
  "eco service": "Basic / Eco Service",
  "basic / eco service": "Basic / Eco Service",
  "basic/eco service": "Basic / Eco Service",
  basic: "Basic / Eco Service",
  eco: "Basic / Eco Service",
  "standard service": "Standard Service",
  standard: "Standard Service",
  "annual service": "Annual Service",
  annual: "Annual Service",
  "full service": "Full Service",
  full: "Full Service",
};

/** Returns the canonical master template name for any historical/free-text label. */
export function canonicalServiceName(name?: string | null): MasterServiceName | null {
  const key = (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return ALIASES[key] ?? null;
}

export type TaskStatus = "pending" | "completed" | "na" | "attention" | "not_completed";

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; short: string; cls: string; customerVisible: boolean }
> = {
  pending: { label: "Not checked yet", short: "—", cls: "text-muted-foreground", customerVisible: false },
  completed: { label: "Completed", short: "✓", cls: "text-status-ready", customerVisible: true },
  na: { label: "Not required / N/A", short: "N/A", cls: "text-muted-foreground", customerVisible: false },
  attention: { label: "Attention required", short: "!", cls: "text-status-parts", customerVisible: false },
  not_completed: { label: "Not completed", short: "✕", cls: "text-destructive", customerVisible: false },
};

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "pending",
  "completed",
  "na",
  "attention",
  "not_completed",
];

export function nextTaskStatus(current?: string | null): TaskStatus {
  const i = TASK_STATUS_ORDER.indexOf((current ?? "pending") as TaskStatus);
  return TASK_STATUS_ORDER[(i + 1) % TASK_STATUS_ORDER.length];
}

export type ServiceTemplate = {
  id: string;
  name: string;
  description: string | null;
  estimated_hours: number | null;
  version: number;
  sort_order: number | null;
  is_active: boolean;
  tasks: Array<{ label: string }>;
};

function normaliseTasks(raw: unknown): Array<{ label: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) =>
      typeof t === "string" ? { label: t } : { label: (t as { label?: string })?.label ?? "" },
    )
    .filter((t) => t.label.trim().length > 0);
}

/** All active service templates, master ones first (by sort_order). */
export async function fetchServiceTemplates(masterOnly = false): Promise<ServiceTemplate[]> {
  const { data, error } = await supabase
    .from("service_templates")
    .select("id,name,description,estimated_hours,version,sort_order,is_active,tasks")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  const rows = (data ?? []).map((t) => ({
    ...(t as unknown as ServiceTemplate),
    tasks: normaliseTasks((t as { tasks?: unknown }).tasks),
  }));
  return masterOnly
    ? rows.filter((t) => (MASTER_SERVICE_NAMES as readonly string[]).includes(t.name))
    : rows;
}

/** Snapshot rows for `job_tasks` — call when a job is created or its template changes. */
export function snapshotRows(jobId: string, template: ServiceTemplate) {
  return template.tasks.map((t, i) => ({
    job_id: jobId,
    label: t.label,
    sort_order: i,
    status: "pending",
    template_id: template.id,
    template_version: template.version,
  }));
}

export type JobTaskLike = { label: string; status?: string | null; is_done?: boolean | null };

/** Items the technician actually confirmed — the only ones safe for invoices/reports. */
export function completedItems(tasks: JobTaskLike[]): string[] {
  return tasks
    .filter((t) => (t.status ? t.status === "completed" : !!t.is_done))
    .map((t) => t.label);
}

/** Items explicitly marked not applicable (e.g. shaft drive → chain N/A). */
export function naItems(tasks: JobTaskLike[]): string[] {
  return tasks.filter((t) => t.status === "na").map((t) => t.label);
}

export function attentionItems(tasks: JobTaskLike[]): string[] {
  return tasks.filter((t) => t.status === "attention").map((t) => t.label);
}

/** Clean customer-facing bullet list of what was actually done. */
export function customerServiceSummary(serviceName: string, tasks: JobTaskLike[]): string {
  const done = completedItems(tasks);
  if (!done.length) return serviceName;
  return `${serviceName}\n${done.map((l) => `• ${l}`).join("\n")}`;
}
