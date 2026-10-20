/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { Check, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HARLEY_INDIAN_LICENSE_PRICE, powerVisionDynoCharge, tunePartNumberForMake, tunePriceForMake } from "@/lib/service-kinds";

export type TuningPlatform = "powervision" | "woolich" | "alientech" | "tuneecu";

/** Harley / Indian licence charged on the invoice (rest of the tune = Dyno charge). */
export const PV_LICENSE_PRICE = HARLEY_INDIAN_LICENSE_PRICE;
export const PV_LICENSE_PN = "PV-LICENSE";

/** Customer tune price (GST incl.) per system. */
export const PLATFORM_PRICE: Record<TuningPlatform, number> = {
  powervision: 1200,
  woolich: 950,
  alientech: 1200,
  tuneecu: 850,
};

const OPTIONS: { id: TuningPlatform; label: string; sub: string; cls: string }[] = [
  { id: "powervision", label: "Power Vision", sub: "Harley / Indian · licence on invoice", cls: "border-service-orange bg-service-orange/15 text-service-orange" },
  { id: "woolich", label: "Woolich Racing", sub: "Tracking only", cls: "border-service-light-blue bg-service-light-blue/15 text-service-light-blue" },
  { id: "alientech", label: "Alientech (XDF)", sub: "Tracking only", cls: "border-service-purple bg-service-purple/15 text-service-purple" },
  { id: "tuneecu", label: "TuneECU", sub: "Tracking only", cls: "border-status-ready bg-status-ready/15 text-status-ready" },
];

const isDynoPart = (p: any) => {
  const pn = String(p.part_number ?? "").toLowerCase();
  const name = String(p.name ?? "").toLowerCase();
  return pn.startsWith("dyno") || name.startsWith("dyno");
};

export function TuningPlatformPicker({
  jobId,
  serviceData,
  make,
  canEdit,
  onChanged,
}: {
  jobId: string;
  serviceData: any;
  make?: string | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const current = (serviceData?.tuning_platform ?? null) as TuningPlatform | null;
  const [busy, setBusy] = useState(false);
  const seeded = useRef(false);

  // Auto-add "Tuning" to Work performed the first time a tuning job card opens.
  useEffect(() => {
    if (!canEdit || seeded.current) return;
    seeded.current = true;
    const wp: any[] = Array.isArray(serviceData?.work_performed) ? serviceData.work_performed : [];
    if (wp.some((e) => /tun/i.test(String(e?.title ?? "")))) return;
    (async () => {
      const { data } = await supabase.from("jobs").select("service_data").eq("id", jobId).maybeSingle();
      const sd: any = (data?.service_data as any) ?? {};
      const list: any[] = Array.isArray(sd.work_performed) ? sd.work_performed : [];
      if (list.some((e) => /tun/i.test(String(e?.title ?? "")))) return;
      const next = { ...sd, work_performed: [...list, { id: `wp-tune-${Date.now()}`, title: "Tuning", detail: "Dyno tuning performed", hours: 0 }] };
      await supabase.from("jobs").update({ service_data: next }).eq("id", jobId);
      onChanged();
    })();
  }, [canEdit, jobId]);

  async function select(platform: TuningPlatform) {
    if (!canEdit || busy) return;
    const next = current === platform ? null : platform;
    setBusy(true);
    try {
      const { data: jobRow } = await supabase.from("jobs").select("service_data").eq("id", jobId).maybeSingle();
      const sd: any = (jobRow?.service_data as any) ?? {};
      await supabase.from("jobs").update({ service_data: { ...sd, tuning_platform: next } }).eq("id", jobId);

      const { data: parts } = await supabase.from("parts").select("*").eq("job_id", jobId);
      const all = parts ?? [];
      const lic = all.find((p: any) => p.part_number === PV_LICENSE_PN);
      const dyno = all.find(isDynoPart);

      // Tune price follows the chosen system (Power Vision splits off the licence).
      const total = next ? PLATFORM_PRICE[next] : tunePriceForMake(make);
      const dynoCharge = next === "powervision" ? powerVisionDynoCharge(total) : total;
      if (dyno) {
        await supabase.from("parts").update({ retail: dynoCharge, cost: dynoCharge }).eq("id", dyno.id);
      } else {
        await supabase.from("parts").insert({
          job_id: jobId, name: "Dyno", part_number: tunePartNumberForMake(make),
          supplier: "Custom tune", quantity: 1, retail: dynoCharge, cost: dynoCharge, on_invoice: true,
        });
      }
      if (next === "powervision" && !lic) {
        await supabase.from("parts").insert({
          job_id: jobId, name: "Power Vision", part_number: PV_LICENSE_PN,
          supplier: "Harley / Indian licence", quantity: 1, retail: PV_LICENSE_PRICE, cost: PV_LICENSE_PRICE, on_invoice: true,
        });
      } else if (next !== "powervision" && lic) {
        await supabase.from("parts").delete().eq("id", lic.id);
      }
      toast.success(next ? `Tuning system: ${OPTIONS.find((o) => o.id === next)?.label ?? next}` : "Tuning system cleared");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-surface p-4 print:hidden">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-status-dyno" />
        <h3 className="font-display text-base font-bold uppercase tracking-wider">Tuning system used</h3>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {OPTIONS.map((o) => {
          const active = current === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={!canEdit || busy}
              onClick={() => select(o.id)}
              className={`relative rounded-xl border-2 p-4 text-left transition-all hover:scale-[1.02] disabled:opacity-60 ${
                active ? `${o.cls} shadow-lg ring-2 ring-offset-2 ring-offset-background ring-current` : "border-border bg-muted/30 text-foreground"
              }`}
            >
              {active && <Check className="absolute top-2 right-2 h-5 w-5" />}
              <div className="font-display text-lg font-bold leading-tight">{o.label}</div>
              <div className="text-[0.6875rem] mt-1 opacity-80">{o.sub}</div>
            </button>
          );
        })}
      </div>
      <p className="text-[0.6875rem] text-muted-foreground mt-2">
        Only Power Vision (Harley / Indian) adds the ${PV_LICENSE_PRICE} licence to the invoice; the rest becomes the Dyno charge. Other systems are for Analytics only.
      </p>
    </section>
  );
}
