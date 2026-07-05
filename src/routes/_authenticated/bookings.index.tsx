import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ClipboardList, Calendar, ArrowDown, ArrowUp, Phone, MessageSquare, Check } from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/bookings/")({
  component: BookingsList,
});

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };

type SortField = "date" | "priority";
type SortDir = "asc" | "desc";

function BookingsList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: rawBookings = [], isLoading } = useQuery({
    queryKey: ["bookings-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, service_type, scheduled_date, drop_off_time, estimated_hours, status, priority, confirmed, confirmed_at, customers(first_name,last_name,phone), motorcycles(year,make,model,rego)")
        .order("scheduled_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function toggleConfirmed(id: string, current: boolean) {
    const { error } = await supabase
      .from("bookings")
      .update({ confirmed: !current, confirmed_at: !current ? new Date().toISOString() : null })
      .eq("id", id);
    if (!error) qc.invalidateQueries({ queryKey: ["bookings-list"] });
  }

  const bookings = useMemo(() => {
    const arr = [...rawBookings];
    arr.sort((a: any, b: any) => {
      if (sortField === "date") {
        const da = new Date(a.scheduled_date).getTime();
        const db = new Date(b.scheduled_date).getTime();
        return sortDir === "asc" ? da - db : db - da;
      }
      // priority
      const pa = PRIORITY_ORDER[a.priority ?? "normal"] ?? 1;
      const pb = PRIORITY_ORDER[b.priority ?? "normal"] ?? 1;
      if (pa !== pb) return sortDir === "asc" ? pb - pa : pa - pb;
      // tie-break by date desc
      const da = new Date(a.scheduled_date).getTime();
      const db = new Date(b.scheduled_date).getTime();
      return db - da;
    });
    return arr;
  }, [rawBookings, sortField, sortDir]);

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Reception</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">Bookings</h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link to="/calendar" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold">
            <Calendar className="h-4 w-4" /> Calendar
          </Link>
          <Link to="/bookings/new" className="inline-flex items-center gap-1.5 rounded-lg gold-surface px-3 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> Book In
          </Link>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Sort by</span>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => { setSortField("date"); setSortDir("desc"); }}
            className={`px-3 py-1.5 text-xs font-semibold ${sortField === "date" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            Date
          </button>
          <button
            onClick={() => { setSortField("priority"); setSortDir("desc"); }}
            className={`px-3 py-1.5 text-xs font-semibold border-l border-border ${sortField === "priority" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
          >
            Priority
          </button>
        </div>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          title="Toggle direction"
        >
          {sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {sortDir === "asc" ? "Ascending" : "Descending"}
        </button>
      </div>

      {isLoading ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : bookings.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <div className="mx-auto h-12 w-12 grid place-items-center rounded-xl bg-muted">
            <ClipboardList className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-display text-lg font-semibold mt-4">No bookings yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first booking and it shows on the calendar.</p>
          <Link to="/bookings/new" className="inline-flex items-center gap-1.5 rounded-lg gold-surface px-4 py-2 text-sm font-semibold mt-4">
            <Plus className="h-4 w-4" /> New booking
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b: any, i: number) => {
            const bike = b.motorcycles ? `${b.motorcycles.year ?? ""} ${b.motorcycles.make} ${b.motorcycles.model}`.trim() : "—";
            const customer = b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : "—";
            const phone = b.customers?.phone ?? "";
            const pLabel = (b.priority ?? "normal").toLowerCase();
            const pColor = pLabel === "high" ? "bg-red-500/20 text-red-400 border-red-500/30" : pLabel === "low" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-muted text-muted-foreground border-border";
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
                role="button"
                tabIndex={0}
                onClick={() => navigate({ to: "/bookings/$bookingId", params: { bookingId: b.id } })}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate({ to: "/bookings/$bookingId", params: { bookingId: b.id } }); } }}
                title="Open job card"
                className="card-surface p-4 flex items-center gap-3 cursor-pointer hover:bg-muted/30"
              >
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleConfirmed(b.id, b.confirmed); }}
                  onKeyDown={(e) => e.stopPropagation()}
                  aria-pressed={b.confirmed}
                  title={b.confirmed ? "Confirmed booking — click to unconfirm" : "Mark booking as confirmed"}
                  className={`shrink-0 h-8 w-8 rounded-md border-2 grid place-items-center transition-colors ${b.confirmed ? "bg-green-500 border-green-500 text-white" : "border-border bg-card hover:border-green-500/60 hover:bg-green-500/10"}`}
                >
                  {b.confirmed && <Check className="h-5 w-5" strokeWidth={3} />}
                </button>
                <div className="w-14 shrink-0 text-center rounded-lg bg-muted py-2">
                  <div className="text-[10px] uppercase text-muted-foreground">{format(new Date(b.scheduled_date), "MMM")}</div>
                  <div className="font-display text-xl font-bold leading-none">{format(new Date(b.scheduled_date), "d")}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold truncate">{bike}</div>
                    {b.confirmed && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                        Confirmed
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{customer} · {b.service_type}{b.motorcycles?.rego ? ` · ${b.motorcycles.rego}` : ""}</div>
                  {phone && (
                    <div className="text-xs text-foreground/80 mt-0.5 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {phone}
                    </div>
                  )}
                </div>
                {phone && (
                  <>
                    <a
                      href={`tel:${phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-semibold hover:bg-muted"
                      title={`Call ${phone}`}
                    >
                      <Phone className="h-3 w-3" /> Call
                    </a>
                    <a
                      href={`sms:${phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs font-semibold hover:bg-muted"
                      title={`Text ${phone}`}
                    >
                      <MessageSquare className="h-3 w-3" /> Text
                    </a>
                  </>
                )}
                <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border ${pColor}`}>
                  {b.priority ?? "normal"}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border border-border text-muted-foreground">
                  {b.status}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
