/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Wrench, Package, Droplet, CalendarClock, Bike } from "lucide-react";
import {
  fetchModelExperience,
  fetchObservationSummary,
  fetchPartUsage,
  usageLabel,
} from "@/lib/garage-learning";

const card = "rounded-lg border border-border bg-card p-3";
const head = "text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground";
const dt = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("en-GB") : "—";

/** WORKSHOP EXPERIENCE — what this workshop has actually done on the model. */
export function ModelExperienceCard({ modelId }: { modelId: string }) {
  const { data: exp } = useQuery({
    queryKey: ["garage-model", modelId, "experience"],
    queryFn: () => fetchModelExperience(modelId),
  });
  const { data: obs } = useQuery({
    queryKey: ["garage-model", modelId, "observations"],
    queryFn: () => fetchObservationSummary(modelId),
  });
  const { data: usage = [] } = useQuery({
    queryKey: ["garage-model", modelId, "part-usage"],
    queryFn: () => fetchPartUsage(modelId),
  });

  const labour = (obs?.labour ?? []).slice(0, 5);
  const ops = (exp?.operations ?? []).slice(0, 5);

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <p className={head}>Workshop experience</p>
        <span className="text-[0.6rem] font-mono uppercase tracking-widest text-muted-foreground">
          Observed, not specified
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric icon={<Bike className="h-3.5 w-3.5" />} label="Bikes serviced" value={String(exp?.bikes ?? 0)} />
        <Metric icon={<Wrench className="h-3.5 w-3.5" />} label="Jobs completed" value={String(exp?.jobs ?? 0)} />
        <Metric icon={<Package className="h-3.5 w-3.5" />} label="Parts observed" value={String(usage.length)} />
        <Metric
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          label="Last serviced"
          value={dt(exp?.last_worked)}
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div>
          <p className={head}>Common operations</p>
          <ul className="mt-1 space-y-1 text-sm">
            {ops.length === 0 && <li className="text-muted-foreground">No completed jobs yet</li>}
            {ops.map((o: any) => (
              <li key={o.title} className="flex justify-between gap-2">
                <span className="truncate">{o.title}</span>
                <span className="font-mono text-xs text-muted-foreground">{o.count}×</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={head}>Typical observed labour</p>
          <ul className="mt-1 space-y-1 text-sm">
            {labour.length === 0 && <li className="text-muted-foreground">No labour observations</li>}
            {labour.map((l: any) => (
              <li key={l.key} className="flex justify-between gap-2">
                <span className="truncate">{l.label}</span>
                <span className="font-mono text-xs">
                  {Number(l.avg).toFixed(1)} h
                  <span className="text-muted-foreground">
                    {" "}
                    ({Number(l.min).toFixed(1)}–{Number(l.max).toFixed(1)} · {l.jobs})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={head}>Common parts</p>
          <ul className="mt-1 space-y-1 text-sm">
            {usage.slice(0, 5).length === 0 && <li className="text-muted-foreground">No parts recorded</li>}
            {usage.slice(0, 5).map((p) => (
              <li key={p.key_norm} className="flex justify-between gap-2">
                <span className="truncate">{p.label}</span>
                <span className="font-mono text-xs text-muted-foreground">{p.jobs}×</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded border border-border/60 bg-muted/20 p-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[0.6rem] font-mono uppercase tracking-widest">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold leading-none">{value}</p>
    </div>
  );
}

/** Part usage with the PREVIOUSLY USED label until a verified reference exists. */
export function PartUsageCard({ modelId }: { modelId: string }) {
  const { data: usage = [] } = useQuery({
    queryKey: ["garage-model", modelId, "part-usage"],
    queryFn: () => fetchPartUsage(modelId),
  });

  return (
    <div className={card}>
      <p className={head}>Part usage · completed jobs</p>
      {usage.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No parts recorded from completed jobs yet.</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={`${head} px-2 py-1 text-left`}>Part</th>
              <th className={`${head} px-2 py-1 text-left`}>Supplier</th>
              <th className={`${head} px-2 py-1 text-right`}>Jobs</th>
              <th className={`${head} px-2 py-1 text-left`}>Last use</th>
              <th className={`${head} px-2 py-1 text-left`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {usage.map((p) => (
              <tr key={p.key_norm} className="border-b border-border/50">
                <td className="px-2 py-1.5">{p.label}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{p.detail ?? "—"}</td>
                <td className="px-2 py-1.5 text-right font-mono">{p.jobs}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{dt(p.last_used)}</td>
                <td className="px-2 py-1.5">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[0.6rem] font-mono uppercase tracking-widest ${
                      p.verified
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {usageLabel(p.verified)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Fluid quantities/products actually used — never presented as a manufacturer spec. */
export function FluidObservationsCard({ modelId }: { modelId: string }) {
  const { data: obs } = useQuery({
    queryKey: ["garage-model", modelId, "observations"],
    queryFn: () => fetchObservationSummary(modelId),
  });
  const fluids = obs?.fluids ?? [];

  return (
    <div className={card}>
      <div className="flex items-center gap-2">
        <Droplet className="h-3.5 w-3.5 text-muted-foreground" />
        <p className={head}>Fluid observations</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Confirmed quantities and products used on completed jobs. Not a manufacturer specification.
      </p>
      {fluids.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {fluids.map((f: any) => (
            <li key={f.key} className="flex items-center justify-between gap-2">
              <span className="truncate">{f.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {f.avg ? `${Number(f.avg).toFixed(2)} ${f.unit ?? ""} avg · ` : ""}
                {f.jobs} job{f.jobs === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/garage-library/updates"
        className="mt-2 inline-block text-[0.65rem] font-mono uppercase tracking-widest text-primary hover:underline"
      >
        Knowledge update proposals →
      </Link>
    </div>
  );
}
