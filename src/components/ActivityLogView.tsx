import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LABELS: Record<string, string> = {
  bookings: "Book-in",
  invoices: "Invoice",
  invoice_payments: "Payment",
  jobs: "Job",
  customers: "Customer",
  motorcycles: "Bike",
  booking_parts: "Parts order",
  parts: "Job part",
  inventory_items: "Inventory item",
  job_notes: "Job note",
  job_photos: "Job photo",
  job_tasks: "Job task",
  daily_notes: "Daily note",
  loan_bikes: "Loan bike",
  time_entries: "Time entry",
  clock_events: "Clock event",
  service_templates: "Service template",
  parts_catalog: "Catalogue part",
  booking_types: "Booking type",
  insurance_claims: "Insurance claim",
  job_inspection_findings: "Inspection finding",
};

const ACTION: Record<string, { label: string; cls: string }> = {
  insert: { label: "Created", cls: "bg-primary/15 text-primary" },
  update: { label: "Edited", cls: "bg-muted text-foreground" },
  delete: { label: "Deleted", cls: "bg-destructive/15 text-destructive" },
};

function summarize(d: any): string {
  if (!d) return "";
  const parts = [
    d.invoice_number,
    d.job_number ? `Job #${d.job_number}` : null,
    d.first_name || d.last_name ? `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() : null,
    d.rego,
    d.service_type,
    d.scheduled_date ? `${d.scheduled_date}${d.drop_off_time ? " " + String(d.drop_off_time).slice(0, 5) : ""}` : null,
    d.title,
    d.name,
    d.part_number,
    d.total != null ? `$${d.total}` : d.amount != null ? `$${d.amount}` : null,
    d.status,
    d.note || d.body || d.content,
  ].filter(Boolean);
  return parts.slice(0, 5).join(" · ").slice(0, 160);
}

export function ActivityLogView({
  onlyDeleted = false,
  tables,
  onRestored,
}: {
  onlyDeleted?: boolean;
  tables?: string[];
  onRestored?: () => void;
}) {
  const qc = useQueryClient();
  const [day, setDay] = useState("");
  const [action, setAction] = useState<string>(onlyDeleted ? "delete" : "all");
  const [table, setTable] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["activity-log", day, action, table, (tables ?? []).join(",")],
    queryFn: async () => {
      let q = supabase
        .from("activity_log")
        .select("*")
        .gte("created_at", subDays(new Date(), 30).toISOString())
        .order("created_at", { ascending: false })
        .limit(500);
      if (day) {
        const start = new Date(day + "T00:00:00");
        const end = new Date(start.getTime() + 86400000);
        q = q.gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
      }
      if (action !== "all") q = q.eq("action", action);
      if (tables?.length) q = q.in("table_name", tables);
      else if (table !== "all") q = q.eq("table_name", table);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: names = {} } = useQuery({
    queryKey: ["activity-actors"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return Object.fromEntries((data ?? []).map((p: any) => [p.id, p.full_name]));
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r: any) =>
      JSON.stringify(r.old_data ?? r.new_data ?? {}).toLowerCase().includes(s),
    );
  }, [rows, search]);

  async function restore(id: string) {
    setBusy(id);
    const { error } = await supabase.rpc("restore_deleted_record" as any, { p_log_id: id });
    setBusy(null);
    if (error) return toast.error(`Could not restore: ${error.message}`);
    toast.success("Restored");
    qc.invalidateQueries();
    onRestored?.();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-auto" />
        {!onlyDeleted && (
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All actions</option>
            <option value="insert">Created</option>
            <option value="update">Edited</option>
            <option value="delete">Deleted</option>
          </select>
        )}
        {!tables && (
          <select
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">Everything</option>
            {Object.entries(LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        )}
        <Input
          placeholder="Search customer, rego, invoice…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px]"
        />
        {day && <Button variant="ghost" size="sm" onClick={() => setDay("")}>Clear date</Button>}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Nothing recorded for this filter.</div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {filtered.map((r: any) => {
            const a = ACTION[r.action] ?? ACTION.update;
            return (
              <div key={r.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="w-32 shrink-0 text-xs text-muted-foreground">
                  {format(new Date(r.created_at), "dd MMM, h:mm a")}
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${a.cls}`}>{a.label}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{LABELS[r.table_name] ?? r.table_name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {summarize(r.old_data ?? r.new_data)}
                  </div>
                </div>
                <div className="hidden sm:block w-28 shrink-0 truncate text-xs text-muted-foreground">
                  {r.actor_id ? names[r.actor_id] ?? "Staff" : "System"}
                </div>
                {r.action === "delete" && (
                  r.restored_at ? (
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">Restored</span>
                  ) : (
                    <Button size="sm" variant="outline" className="w-24 shrink-0" disabled={busy === r.id} onClick={() => restore(r.id)}>
                      {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                      Restore
                    </Button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
