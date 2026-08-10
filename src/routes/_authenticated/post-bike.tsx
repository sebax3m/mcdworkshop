/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Truck, MapPin, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BookInCard } from "@/components/booking/BookInCard";
import { BRANCHES, isPostBike, type Branch } from "@/lib/post-bike";
import { toast } from "sonner";

type Search = { branch?: string };

export const Route = createFileRoute("/_authenticated/post-bike")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    branch: typeof s.branch === "string" ? s.branch : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Post Bike branches — Motorcycle Doctors Workshop" },
      {
        name: "description",
        content:
          "Post Bike motorcycles tracked separately by branch: Beachlands, Manukau and Pukekohe.",
      },
      { property: "og:title", content: "Post Bike branches — Motorcycle Doctors Workshop" },
      {
        property: "og:description",
        content: "Track Post Bike motorcycles per branch across the workshop network.",
      },
    ],
  }),
  component: PostBikePage,
});

function usePostBikes() {
  return useQuery({
    queryKey: ["post-bikes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, service_type, service_type_other, scheduled_date, drop_off_time, status, confirmed, bike_arrived, loan_bike, job_id, rego, branch, notes, assigned_tech_id, customers(first_name,last_name,phone), motorcycles(year,make,model,rego,photos)",
        )
        .order("scheduled_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).filter((b: any) => isPostBike(b.service_type));
    },
  });
}

function PostBikePage() {
  const { branch } = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: bikes = [], isLoading } = usePostBikes();

  const countFor = (b: Branch) => (bikes as any[]).filter((x) => x.branch === b).length;
  const unassigned = (bikes as any[]).filter((x) => !x.branch);

  async function setBranch(id: string, value: string | null) {
    const { error } = await supabase.from("bookings").update({ branch: value }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(value ? `Moved to ${value}` : "Branch cleared");
    qc.invalidateQueries({ queryKey: ["post-bikes"] });
  }

  const list = branch ? (bikes as any[]).filter((x) => x.branch === branch) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {branch && (
            <button
              onClick={() => nav({ to: "/post-bike", search: {} })}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:border-primary/50"
              aria-label="Back to branches"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold leading-tight flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" /> Post Bike {branch ? `— ${branch}` : ""}
            </h1>
            <div className="text-xs text-muted-foreground">
              {branch
                ? `${list.length} motorcycle${list.length === 1 ? "" : "s"} at this branch`
                : "Separate control of post bikes per branch"}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading post bikes…</div>
      ) : !branch ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {BRANCHES.map((b) => (
              <Link
                key={b}
                to="/post-bike"
                search={{ branch: b }}
                className="card-surface p-4 flex items-center gap-3 hover:border-primary/50 transition-colors"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                  <MapPin className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-display text-base font-bold">{b}</span>
                  <span className="block text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                    {countFor(b)} bikes
                  </span>
                </span>
                <span className="font-display text-2xl font-bold tabular-nums">{countFor(b)}</span>
              </Link>
            ))}
          </div>

          <section className="card-surface p-3 space-y-2">
            <h2 className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Not assigned to a branch ({unassigned.length})
            </h2>
            {unassigned.length === 0 ? (
              <div className="text-xs text-muted-foreground py-3 text-center">
                Every post bike has a branch.
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {unassigned.map((b) => (
                  <PostBikeItem key={b.id} booking={b} onSetBranch={setBranch} />
                ))}
              </div>
            )}
          </section>
        </>
      ) : list.length === 0 ? (
        <div className="card-surface p-8 text-center text-sm text-muted-foreground">
          No post bikes at {branch} yet.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <PostBikeItem key={b.id} booking={b} onSetBranch={setBranch} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostBikeItem({
  booking,
  onSetBranch,
}: {
  booking: any;
  onSetBranch: (id: string, value: string | null) => void;
}) {
  const nav = useNavigate();
  return (
    <div className="space-y-1.5">
      <BookInCard
        booking={booking}
        onClick={() => nav({ to: "/bookings/$bookingId", params: { bookingId: booking.id } })}
      />
      <div className="flex items-center gap-1.5">
        <select
          value={booking.branch ?? ""}
          onChange={(e) => onSetBranch(booking.id, e.target.value || null)}
          className="flex-1 rounded-lg border border-border bg-background px-2 h-8 text-xs"
        >
          <option value="">No branch</option>
          {BRANCHES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <span className="text-[0.625rem] text-muted-foreground whitespace-nowrap">
          {booking.scheduled_date ? format(new Date(booking.scheduled_date), "d MMM") : ""}
        </span>
      </div>
    </div>
  );
}
