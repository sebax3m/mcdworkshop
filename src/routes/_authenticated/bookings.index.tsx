import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ClipboardList, Calendar } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/bookings/")({
  component: BookingsList,
});

function BookingsList() {
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, service_type, scheduled_date, drop_off_time, estimated_hours, status, customers(first_name,last_name), motorcycles(year,make,model,rego)")
        .order("scheduled_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

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
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
              >
                <Link
                  to="/bookings/$bookingId"
                  params={{ bookingId: b.id }}
                  className="card-surface p-4 flex items-center gap-3 hover:border-primary/40 transition-colors"
                >
                  <div className="w-14 shrink-0 text-center rounded-lg bg-muted py-2">
                    <div className="text-[10px] uppercase text-muted-foreground">{format(new Date(b.scheduled_date), "MMM")}</div>
                    <div className="font-display text-xl font-bold leading-none">{format(new Date(b.scheduled_date), "d")}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{bike}</div>
                    <div className="text-xs text-muted-foreground truncate">{customer} · {b.service_type}{b.motorcycles?.rego ? ` · ${b.motorcycles.rego}` : ""}</div>
                  </div>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border border-border text-muted-foreground">
                    {b.status}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}