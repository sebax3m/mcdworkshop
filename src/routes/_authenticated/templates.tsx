import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, Gauge, Sparkles, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates")({
  component: Templates,
});

const CONTENT: Record<string, { icon: any; tagline: string; body: string; covers: string[] }> = {
  "Basic Service": {
    icon: Sparkles,
    tagline: "Essential maintenance",
    body: "Routine upkeep to keep the bike running smoothly between major services. The technician changes engine oil and filter, lubes and adjusts the chain, checks tyre pressures, brakes, lights, steering and forks, then takes the bike for a short test ride.",
    covers: ["Engine oil & filter", "Chain clean / lube / adjust", "Tyre & brake inspection", "Lights, steering & forks", "Test ride"],
  },
  "Standard Service": {
    icon: ShieldCheck,
    tagline: "Recommended at manufacturer intervals",
    body: "Everything in the Basic service plus the consumables most bikes need at the manufacturer's recommended interval — spark plugs, air filter, brake fluid and clutch fluid (if hydraulic), and a coolant top-up. Ideal for riders following the service book.",
    covers: ["All Basic items", "Spark plug replacement", "Air filter replacement", "Brake & clutch fluid", "Coolant top-up"],
  },
  "Annual Service": {
    icon: Wrench,
    tagline: "Yearly comprehensive service",
    body: "The once-a-year deep service. All fluids and filters are refreshed and a comprehensive safety check is performed so the bike is ready for another season of riding.",
    covers: ["All fluids refreshed", "All filters replaced", "Spark plugs", "Full safety inspection", "Test ride"],
  },
  "Full Service": {
    icon: Zap,
    tagline: "Complete performance service",
    body: "Our most thorough service — everything in Standard plus a valve clearance check. Each cylinder's intake and exhaust valves are measured against spec; if a shim adjustment is required additional labour is quoted. Recommended at the manufacturer's valve interval.",
    covers: ["All Standard items", "Valve clearance check (per cylinder)", "Compression check", "Shim adjustment quoted if needed"],
  },
  "Dyno Tune": {
    icon: Gauge,
    tagline: "Power, torque & AFR optimisation",
    body: "The bike is strapped to the dyno for back-to-back power and AFR runs. Baseline (before) and final (after) power and torque figures are logged so the customer sees exactly what they gained. ECU map, fuel and ignition trims are adjusted between runs until the bike is safely making maximum power.",
    covers: ["Baseline dyno run", "ECU / fuel / ignition tuning", "Final dyno run", "Before vs after power & torque graph"],
  },
};

function Templates() {
  const { data: templates = [] } = useQuery({
    queryKey: ["templates-page"],
    queryFn: async () => (await supabase.from("service_templates").select("*").order("sort_order")).data ?? [],
  });

  // de-dupe by name (older seeds left duplicates around)
  const unique = Array.from(new Map((templates as any[]).map((t) => [t.name, t])).values());

  return (
    <div className="space-y-5">
      <header>
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Workshop</div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Service Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The service options offered to customers. Each one drops into a new job in one tap.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-3">
        {unique.map((t: any) => {
          const c = CONTENT[t.name] ?? {
            icon: Wrench,
            tagline: "Service",
            body: t.description ?? "Custom service template.",
            covers: [],
          };
          const Icon = c.icon;
          return (
            <div key={t.id} className="card-surface p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-primary">{c.tagline}</div>
                  <div className="font-display text-xl font-bold leading-tight">{t.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">~{t.estimated_hours}h estimated</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{c.body}</p>
              {c.covers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {c.covers.map((cv, i) => (
                    <span key={i} className="text-[10px] font-semibold uppercase tracking-wider rounded-full border border-border bg-muted/40 px-2 py-1">
                      {cv}
                    </span>
                  ))}
                </div>
              )}
              {t.name === "Dyno Tune" && (
                <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <span className="font-bold text-primary">Recorded on the job card:</span> baseline power & torque (before)
                  and final power & torque (after). No checklist — just numbers and the dyno graph.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}