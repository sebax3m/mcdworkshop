/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Wrench,
  User,
  Bike as BikeIcon,
  FileText,
  KeyRound,
} from "lucide-react";
import { LoanBikeDialog } from "@/components/booking/LoanBikeDialog";
import { toast } from "sonner";
import { displayCustomerName } from "@/lib/display";
import { fullBike } from "@/lib/format";
import { getSignedUrls } from "@/lib/photos";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/bookings/$bookingId")({
  component: BookingDetail,
});

function BookingDetail() {
  const { bookingId } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [converting, setConverting] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loanOpen, setLoanOpen] = useState(false);

  const { data: b, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "*, customers(first_name,last_name,phone,email), motorcycles(year,make,model,rego,vin,mileage), loan_bikes(name,rego)",
        )
        .eq("id", bookingId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const customerBikes = useQuery({
    queryKey: ["booking-customer-bikes", b?.customer_id],
    enabled: !!b?.customer_id,
    queryFn: () => fetchCustomerBikes(b?.customer_id),
  });



  useEffect(() => {
    const photos = b?.arrival_photos as string[] | undefined;
    if (photos?.length) getSignedUrls(photos).then(setPhotoUrls);
    else setPhotoUrls([]);
  }, [b?.arrival_photos]);

  async function createJob() {
    if (!b) return;
    setConverting(true);
    try {
      const { data: tmpl } = await supabase
        .from("service_templates")
        .select("*")
        .ilike("name", `%${b.service_type.split(" ")[0]}%`)
        .limit(1)
        .maybeSingle();
      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          customer_id: b.customer_id,
          motorcycle_id: b.motorcycle_id,
          template_id: tmpl?.id ?? null,
          technician_id: b.assigned_tech_id,
          assigned_tech_id: b.assigned_tech_id,
          title: b.service_type,
          description: tmpl?.description ?? null,
          complaint: b.complaints,
          estimated_hours: b.estimated_hours,
          status: b.assigned_tech_id ? "assigned" : "new",
          scheduled_at: b.scheduled_date,
        })
        .select("id")
        .single();
      if (error) throw error;
      if (tmpl?.tasks) {
        const tasks = (tmpl.tasks as any[]).map((t: any, i: number) => ({
          job_id: job.id,
          label: t.label,
          sort_order: i,
        }));
        if (tasks.length) await supabase.from("job_tasks").insert(tasks);
      }
      await supabase
        .from("bookings")
        .update({ job_id: job.id, status: "checked_in" })
        .eq("id", b.id);
      qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
      toast.success("Job card created");
      nav({ to: "/jobs/$jobId", params: { jobId: job.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to convert");
    } finally {
      setConverting(false);
    }
  }

  if (isLoading || !b)
    return (
      <div className="card-surface p-8 text-center text-sm text-muted-foreground">Loading…</div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 max-w-3xl mx-auto"
    >
      <header className="flex items-center gap-3">
        <Link
          to="/calendar"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:border-primary/50"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Booking</div>
          <h1 className="font-display text-2xl font-bold truncate">{b.service_type}</h1>
        </div>
      </header>

      <div className="card-surface p-4 grid sm:grid-cols-2 gap-4">
        <InfoRow
          icon={Calendar}
          label="Date"
          value={format(new Date(b.scheduled_date), "EEE d MMM yyyy")}
        />
        <InfoRow
          icon={Clock}
          label="Drop-off"
          value={b.drop_off_time ? b.drop_off_time.slice(0, 5) : "—"}
        />
        <InfoRow
          icon={User}
          label="Customer"
          value={displayCustomerName(b.customers)}
          sub={b.customers?.phone || b.customers?.email}
        />
        <InfoRow
          icon={BikeIcon}
          label="Motorcycle"
          value={fullBike(b.motorcycles)}
          sub={[b.motorcycles?.rego, b.mileage ? `${b.mileage} km` : null]
            .filter(Boolean)
            .join(" · ")}
        />
        <InfoRow icon={Wrench} label="Est. hours" value={`${b.estimated_hours ?? "—"}h`} />
        <InfoRow icon={FileText} label="Status" value={b.status} />
      </div>

      <div className="card-surface p-4 space-y-2">
        <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <BikeIcon className="h-3 w-3" /> Change motorcycle for this customer
        </div>
        <select
          value={b.motorcycle_id || ""}
          onChange={async (e) => {
            const newBikeId = e.target.value || null;
            if (newBikeId === b.motorcycle_id) return;
            const pick = (customerBikes.data ?? []).find((x) => x.id === newBikeId);
            const { error } = await changeBookingMotorcycle({
              bookingId,
              motorcycleId: newBikeId,
              bike: pick ?? null,
            });
            if (error) return toast.error(error);
            qc.invalidateQueries({ queryKey: ["booking", bookingId] });
            qc.invalidateQueries({ queryKey: ["calendar-bookings"] });
            toast.success("Motorcycle updated everywhere");
          }}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary/60 outline-none"
        >
          <option value="">— Select motorcycle —</option>
          {(customerBikes.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {`${m.year ?? ""} ${m.make ?? ""} ${m.model ?? ""}`.trim()}
              {m.rego ? ` · ${m.rego}` : ""}
            </option>
          ))}
        </select>
        {(customerBikes.data ?? []).length <= 1 && (
          <p className="text-xs text-muted-foreground">
            This customer has only one bike on file. Add more from their customer profile.
          </p>
        )}
      </div>



      <div className="card-surface p-4 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
          <KeyRound className="h-4 w-4 text-primary" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            Loan bike
          </div>
          <div className="text-sm font-semibold truncate">
            {b.loan_bikes
              ? `${b.loan_bikes.name}${b.loan_bikes.rego ? ` · ${b.loan_bikes.rego}` : ""}`
              : "None assigned"}
          </div>
          {b.loan_bikes && (
            <div className="text-xs text-muted-foreground truncate">
              {b.loan_bike_returned_at
                ? `Returned ${format(new Date(b.loan_bike_returned_at), "d MMM yyyy")}`
                : b.loan_bike_expected_return
                  ? `Expected back ${format(new Date(b.loan_bike_expected_return + "T00:00:00"), "EEE d MMM")}`
                  : "Out"}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setLoanOpen(true)}>
          {b.loan_bikes ? "Edit" : "Add loan bike"}
        </Button>
      </div>

      <LoanBikeDialog
        bookingId={bookingId}
        open={loanOpen}
        onOpenChange={setLoanOpen}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["booking", bookingId] });
          qc.invalidateQueries({ queryKey: ["loan-bikes"] });
          qc.invalidateQueries({ queryKey: ["loan-bikes-active-assignments"] });
        }}
      />

      {b.complaints && (
        <div className="card-surface p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Customer complaint
          </div>
          <p className="text-sm mt-1.5 whitespace-pre-wrap">{b.complaints}</p>
        </div>
      )}

      {photoUrls.length > 0 && (
        <div className="card-surface p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Arrival photos
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photoUrls.map((u, i) => (
              <a
                key={i}
                href={u}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square rounded-lg overflow-hidden bg-muted"
              >
                <img
                  src={u}
                  alt=""
                  className="h-full w-full object-cover hover:scale-105 transition-transform"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {!b.job_id ? (
        <Button
          onClick={createJob}
          disabled={converting}
          className="w-full h-14 gold-surface text-base font-bold"
        >
          {converting ? "Creating job…" : "→ Create Job Card from Booking"}
        </Button>
      ) : (
        <Link
          to="/jobs/$jobId"
          params={{ jobId: b.job_id }}
          className="block w-full text-center rounded-xl gold-surface h-14 leading-[3.5rem] font-bold"
        >
          Open Job Card →
        </Link>
      )}
    </motion.div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0">
        <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-semibold truncate">{value || "—"}</div>
        {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
      </div>
    </div>
  );
}
