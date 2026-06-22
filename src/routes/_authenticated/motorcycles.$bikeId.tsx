import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bike as BikeIcon, ChevronLeft, Gauge, User, Hash, Wrench } from "lucide-react";
import { fullBike } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/motorcycles/$bikeId")({
  component: BikeProfile,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="card-surface p-6 space-y-3">
        <div className="font-semibold">Couldn't load bike</div>
        <div className="text-sm text-muted-foreground">{error.message}</div>
        <button
          className="text-sm text-primary"
          onClick={() => { reset(); router.invalidate(); }}
        >
          Try again
        </button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="card-surface p-6 text-sm text-muted-foreground">Bike not found.</div>
  ),
});

function BikeProfile() {
  const { bikeId } = Route.useParams();

  const bike = useQuery({
    queryKey: ["bike", bikeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycles")
        .select("*, customers(id, first_name, last_name, phone, email)")
        .eq("id", bikeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const jobs = useQuery({
    queryKey: ["bike-jobs", bikeId],
    queryFn: async () => (await supabase
      .from("jobs")
      .select("id, job_number, title, status, created_at")
      .eq("motorcycle_id", bikeId)
      .order("created_at", { ascending: false })
      .limit(20)).data ?? [],
  });

  if (bike.isLoading) return <div className="card-surface p-6 text-sm text-muted-foreground">Loading…</div>;
  const b: any = bike.data;
  if (!b) return <div className="card-surface p-6 text-sm text-muted-foreground">Bike not found.</div>;

  const photos: string[] = Array.isArray(b.photos) ? b.photos : [];
  const hero = photos[0];

  return (
    <div className="space-y-5">
      <Link to="/motorcycles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All bikes
      </Link>

      <div className="card-surface overflow-hidden">
        {hero ? (
          <img src={hero} alt={fullBike(b)} className="w-full aspect-[16/9] object-cover" />
        ) : (
          <div className="w-full aspect-[16/9] grid place-items-center bg-muted">
            <BikeIcon className="h-10 w-10 text-primary" />
          </div>
        )}
        <div className="p-4 space-y-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{b.make}</div>
          <h1 className="font-display text-2xl font-bold">{b.model}</h1>
          <div className="text-sm text-muted-foreground">
            {b.year ?? "—"}{b.rego ? ` · ${b.rego}` : ""}
          </div>
        </div>
      </div>

      {photos.length > 1 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.slice(1).map((p, i) => (
            <img key={i} src={p} alt="" loading="lazy" className="rounded-lg border border-border object-cover aspect-square" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={<Gauge className="h-4 w-4" />} label="Mileage" value={b.mileage ? `${b.mileage.toLocaleString()} km` : "—"} />
        <Stat icon={<Hash className="h-4 w-4" />} label="VIN" value={b.vin || "—"} />
      </div>

      {b.customers && (
        <div className="card-surface p-4 space-y-1">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Owner</div>
          <div className="font-semibold">{b.customers.first_name} {b.customers.last_name}</div>
          <div className="text-sm text-muted-foreground">{b.customers.phone || b.customers.email || ""}</div>
        </div>
      )}

      {(b.ecu_info || b.modifications || b.notes) && (
        <div className="card-surface p-4 space-y-3">
          {b.modifications && <Field label="Modifications" value={b.modifications} />}
          {b.ecu_info && <Field label="ECU" value={b.ecu_info} />}
          {b.notes && <Field label="Notes" value={b.notes} />}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">
          <Wrench className="h-3 w-3" /> Service history
        </div>
        {(jobs.data ?? []).length === 0 && (
          <div className="card-surface p-4 text-sm text-muted-foreground">No jobs yet.</div>
        )}
        {(jobs.data ?? []).map((j: any) => (
          <Link
            key={j.id}
            to="/jobs/$jobId"
            params={{ jobId: j.id }}
            className="card-surface p-3 flex items-center justify-between hover:border-primary/40"
          >
            <div className="min-w-0">
              <div className="font-semibold truncate text-sm">{j.title || j.job_number}</div>
              <div className="text-xs text-muted-foreground">{j.job_number} · {new Date(j.created_at).toLocaleDateString()}</div>
            </div>
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-muted">{j.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card-surface p-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="font-semibold text-sm mt-1 truncate">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}