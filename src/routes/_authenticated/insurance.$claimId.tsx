import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, ShieldCheck, Phone, MessageSquare, Wrench, Printer, Send, Check, X,
  Bike as BikeIcon, ExternalLink, Trash2, Mail,
  Inbox, ClipboardList, FileEdit, FileCheck2, ThumbsUp, Package, Hammer, PackageCheck, Archive, ChevronRight,
} from "lucide-react";

import { toast } from "sonner";
import { format } from "date-fns";
import { fullBike } from "@/lib/format";
import { CLAIM_PIPELINE, CLAIM_STATUS_META, type ClaimStatus, nextStatus } from "@/lib/insurance";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/insurance/$claimId")({
  component: ClaimDetail,
});

function ClaimDetail() {
  const { claimId } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { isAdmin } = useCurrentUser();

  const claim = useQuery({
    queryKey: ["insurance-claim", claimId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("insurance_claims")
        .select(
          "*, customers(id,first_name,last_name,phone,email), motorcycles(id,year,make,model,rego,vin,color,odometer), jobs(id,job_number,title,status)",
        )
        .eq("id", claimId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const events = useQuery({
    queryKey: ["insurance-claim-events", claimId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("insurance_claim_events")
        .select("*")
        .eq("claim_id", claimId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const c = claim.data;

  async function updateClaim(patch: any, eventNote?: string) {
    const { error } = await (supabase as any).from("insurance_claims").update(patch).eq("id", claimId);
    if (error) return toast.error(error.message);
    if (eventNote) {
      await (supabase as any).from("insurance_claim_events").insert({
        claim_id: claimId,
        event_type: "note",
        note: eventNote,
      });
    }
    qc.invalidateQueries({ queryKey: ["insurance-claim", claimId] });
    qc.invalidateQueries({ queryKey: ["insurance-claim-events", claimId] });
    qc.invalidateQueries({ queryKey: ["insurance-claims"] });
  }

  async function setStatus(s: ClaimStatus) {
    await updateClaim({ status: s });
    toast.success(`Status: ${CLAIM_STATUS_META[s].label}`);
  }

  async function startQuote() {
    if (!c) return;
    if (c.job_id) {
      nav({ to: "/jobs/$jobId", params: { jobId: c.job_id } });
      return;
    }
    // Create a linked Collision Repair job card
    const title = `Collision Repair — ${c.claim_number}`;
    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        customer_id: c.customer_id,
        motorcycle_id: c.motorcycle_id,
        title,
        description: `Insurance claim ${c.claim_number}${c.insurer_name ? ` · ${c.insurer_name}` : ""}`,
        complaint: c.notes ?? null,
        status: "new",
      } as any)
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await updateClaim({ job_id: job.id, status: "quote_in_progress" });
    toast.success("Quote job card created");
    nav({ to: "/jobs/$jobId", params: { jobId: job.id } });
  }

  async function markSent() {
    const sentAt = new Date().toISOString();
    await updateClaim({ status: "quote_sent", quote_sent_at: sentAt });
    await (supabase as any).from("insurance_claim_events").insert({
      claim_id: claimId, event_type: "quote_sent", note: "Quote sent to insurer",
    });
    qc.invalidateQueries({ queryKey: ["insurance-claim-events", claimId] });
    toast.success("Marked as sent to insurer");
  }

  async function deleteClaim() {
    if (!isAdmin) return toast.error("Only admins can delete claims");
    if (!confirm("Delete this claim? Timeline will be removed. Linked job card stays.")) return;
    const { error } = await (supabase as any).from("insurance_claims").delete().eq("id", claimId);
    if (error) return toast.error(error.message);
    toast.success("Claim deleted");
    nav({ to: "/insurance" });
  }

  if (claim.isLoading) return <div className="card-surface p-8 text-center text-muted-foreground">Loading…</div>;
  if (!c) return <div className="card-surface p-8 text-center text-muted-foreground">Claim not found.</div>;

  const meta = CLAIM_STATUS_META[c.status as ClaimStatus];
  const next = nextStatus(c.status as ClaimStatus);
  const bikeText = c.motorcycles ? fullBike(c.motorcycles) : "—";
  const phone = c.customers?.phone;

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      <header className="flex items-center gap-3 flex-wrap">
        <Link to="/insurance" className="grid h-9 w-9 place-items-center rounded-lg border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Insurance Claim</div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2 flex-wrap">
            {c.claim_number}
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta?.cls}`}>
              {meta?.label}
            </span>
          </h1>
        </div>
        <Button onClick={() => window.print()} variant="outline" size="sm" className="gap-2">
          <Printer className="h-4 w-4" /> Print Quote
        </Button>
        {isAdmin && (
          <Button onClick={deleteClaim} variant="outline" size="sm" className="gap-2 text-destructive border-destructive/40">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        )}
      </header>

      {/* Pipeline flowchart */}
      <PipelineFlow currentStatus={c.status as ClaimStatus} onPick={setStatus} next={next} />


      {/* Customer / bike / insurer */}
      <section className="grid sm:grid-cols-2 gap-4">
        <div className="card-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Customer</div>
          <div className="font-bold">{c.customers?.first_name} {c.customers?.last_name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{c.customers?.email ?? "—"}</div>
          {phone && (
            <div className="mt-2 flex gap-2">
              <a href={`tel:${phone}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:border-primary/40">
                <Phone className="h-3 w-3" /> {phone}
              </a>
              <a href={`sms:${phone}`} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:border-primary/40">
                <MessageSquare className="h-3 w-3" /> Text
              </a>
            </div>
          )}
        </div>
        <div className="card-surface p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Motorcycle</div>
          <div className="font-bold flex items-center gap-1.5"><BikeIcon className="h-4 w-4" /> {bikeText}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Rego {c.motorcycles?.rego ?? "—"} · VIN {c.motorcycles?.vin ?? "—"} · {c.motorcycles?.odometer ?? "—"}km
          </div>
        </div>
      </section>

      <ClaimInsurerCard c={c} onUpdate={updateClaim} />

      <ClaimCustodyCard c={c} onUpdate={updateClaim} />

      {/* Quote / linked job */}
      <section className="card-surface p-4">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-semibold">Quote · Parts & Labour</h2>
        </div>
        {c.job_id ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-background/40 p-3 flex items-center gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Linked job card</div>
                <div className="font-bold">#{c.jobs?.job_number} · {c.jobs?.title}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">{c.jobs?.status}</div>
              </div>
              <Link
                to="/jobs/$jobId"
                params={{ jobId: c.job_id }}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg red-surface px-3 py-2 text-sm font-bold"
              >
                Open job card <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Quote total ($)</Label>
                <Input
                  type="number" step="0.01"
                  defaultValue={c.quote_amount ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    if (v !== (c.quote_amount ?? null)) updateClaim({ quote_amount: v });
                  }}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Approved amount ($)</Label>
                <Input
                  type="number" step="0.01"
                  defaultValue={c.approved_amount ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    if (v !== (c.approved_amount ?? null)) updateClaim({ approved_amount: v });
                  }}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {c.status !== "quote_sent" && c.status !== "approved" && c.status !== "declined" && (
                <Button onClick={markSent} className="gold-surface gap-2">
                  <Send className="h-4 w-4" /> Mark as sent to insurer
                </Button>
              )}
              {c.customers?.email && (
                <a
                  href={`mailto:?subject=${encodeURIComponent(`Quote ${c.claim_number} — ${c.insurer_name ?? ""}`)}&body=${encodeURIComponent(`Hi,\n\nPlease find attached our repair quote for claim ${c.claim_number} (${bikeText}).\n\nQuote total: $${c.quote_amount ?? ""}\n\nKind regards,\nMotorcycle Doctors`)}`}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-primary/40"
                >
                  <Mail className="h-4 w-4" /> Email customer
                </a>
              )}
              {c.status === "quote_sent" && (
                <>
                  <Button onClick={() => setStatus("approved")} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                    <Check className="h-4 w-4" /> Insurer approved
                  </Button>
                  <Button onClick={() => setStatus("declined")} variant="outline" className="gap-2 text-destructive border-destructive/40">
                    <X className="h-4 w-4" /> Insurer declined
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Start the quote — this creates a Collision Repair job card where you log parts and labour estimates. The job stays linked to this claim.
            </p>
            <Button onClick={startQuote} className="gold-surface gap-2 h-11 px-5 font-bold">
              <Plus className="h-4 w-4" /> Start Quote (create job card)
            </Button>
          </div>
        )}
      </section>

      {/* Notes */}
      <ClaimNotesCard c={c} onUpdate={updateClaim} />

      {/* Timeline */}
      <section className="card-surface p-4 print:hidden">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Timeline</div>
        {events.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (events.data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">No events yet.</div>
        ) : (
          <ol className="space-y-2">
            {(events.data ?? []).map((e: any) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <div className="w-32 shrink-0 text-[11px] text-muted-foreground">
                  {format(new Date(e.created_at), "d MMM HH:mm")}
                </div>
                <div className="min-w-0">
                  {e.event_type === "status_changed" ? (
                    <span>
                      Status: <b>{CLAIM_STATUS_META[e.from_status as ClaimStatus]?.label ?? e.from_status ?? "—"}</b>
                      {" → "}
                      <b>{CLAIM_STATUS_META[e.to_status as ClaimStatus]?.label ?? e.to_status}</b>
                    </span>
                  ) : (
                    <span><b className="capitalize">{e.event_type.replace(/_/g, " ")}</b>{e.note ? ` — ${e.note}` : ""}</span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Print-only quote header */}
      <PrintQuoteHeader c={c} bikeText={bikeText} />
    </div>
  );
}

import { Plus } from "lucide-react";

function ClaimInsurerCard({ c, onUpdate }: { c: any; onUpdate: (p: any) => void }) {
  const [insurer, setInsurer] = useState(c.insurer_name ?? "");
  const [ref, setRef] = useState(c.insurer_claim_ref ?? "");
  return (
    <section className="card-surface p-4 grid sm:grid-cols-2 gap-3">
      <div>
        <Label>Insurer</Label>
        <Input value={insurer} onChange={(e) => setInsurer(e.target.value)} onBlur={() => insurer !== (c.insurer_name ?? "") && onUpdate({ insurer_name: insurer || null })} />
      </div>
      <div>
        <Label>Insurer claim reference</Label>
        <Input value={ref} onChange={(e) => setRef(e.target.value)} onBlur={() => ref !== (c.insurer_claim_ref ?? "") && onUpdate({ insurer_claim_ref: ref || null })} />
      </div>
    </section>
  );
}

function ClaimCustodyCard({ c, onUpdate }: { c: any; onUpdate: (p: any) => void }) {
  return (
    <section className="card-surface p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Bike custody</div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!c.bike_with_customer}
          onChange={(e) => onUpdate({
            bike_with_customer: e.target.checked,
            expected_return_date: e.target.checked ? c.expected_return_date : null,
          })}
        />
        Bike currently with customer
      </label>
      {c.bike_with_customer && (
        <div className="mt-3 max-w-xs">
          <Label>Expected return date</Label>
          <Input
            type="date"
            defaultValue={c.expected_return_date ?? ""}
            onBlur={(e) => e.target.value !== (c.expected_return_date ?? "") && onUpdate({ expected_return_date: e.target.value || null })}
          />
        </div>
      )}
    </section>
  );
}

function ClaimNotesCard({ c, onUpdate }: { c: any; onUpdate: (p: any) => void }) {
  const [notes, setNotes] = useState(c.notes ?? "");
  return (
    <section className="card-surface p-4">
      <Label>Damage notes / claim details</Label>
      <Textarea
        rows={4}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => notes !== (c.notes ?? "") && onUpdate({ notes: notes || null })}
        placeholder="What was damaged, what needs replacing, photos taken, etc."
      />
    </section>
  );
}

function PrintQuoteHeader({ c, bikeText }: { c: any; bikeText: string }) {
  return (
    <div className="hidden print:block">
      <div className="border-b-2 border-black pb-3 mb-4">
        <div className="text-[10px] uppercase tracking-[0.25em] text-gray-600">Motorcycle Doctors · Insurance Quote</div>
        <div className="flex items-end justify-between gap-4">
          <h1 className="font-display text-2xl font-bold leading-tight">Claim {c.claim_number}</h1>
          <div className="text-right text-xs">
            <div><b>Insurer:</b> {c.insurer_name ?? "—"}</div>
            <div><b>Ref:</b> {c.insurer_claim_ref ?? "—"}</div>
            <div><b>Received:</b> {format(new Date(c.date_received), "d MMM yyyy")}</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-xs mb-3">
        <div className="border border-gray-400 rounded p-2">
          <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">Customer</div>
          <div className="font-bold">{c.customers?.first_name} {c.customers?.last_name}</div>
          <div>{c.customers?.phone ?? "—"} · {c.customers?.email ?? "—"}</div>
        </div>
        <div className="border border-gray-400 rounded p-2">
          <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">Vehicle</div>
          <div className="font-bold">{bikeText}</div>
          <div>Rego {c.motorcycles?.rego ?? "—"} · VIN {c.motorcycles?.vin ?? "—"}</div>
        </div>
      </div>
      {c.notes && (
        <div className="border border-gray-400 rounded p-2 mb-3 text-xs">
          <div className="text-[9px] uppercase tracking-wider text-gray-500 mb-1">Damage</div>
          <p className="whitespace-pre-wrap">{c.notes}</p>
        </div>
      )}
      <div className="text-xs">
        <b>Quote total:</b> <span className="font-mono">${c.quote_amount != null ? Number(c.quote_amount).toFixed(2) : "_______"}</span>
      </div>
      <div className="mt-2 text-[10px] text-gray-600">Parts and labour breakdown is on the linked Collision Repair job card — print and attach.</div>
    </div>
  );
}

// ----- Pipeline flowchart ---------------------------------------------------

const FLOW_STAGES: Array<{
  key: ClaimStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Tailwind color group for this stage. */
  hue: { ring: string; bg: string; text: string; border: string; soft: string };
}> = [
  { key: "intake",            label: "Intake",          icon: Inbox,         hue: { ring: "ring-sky-400/60",     bg: "bg-sky-500",      text: "text-sky-300",     border: "border-sky-400/50",     soft: "bg-sky-500/10" } },
  { key: "assessing",         label: "Assessing",       icon: ClipboardList, hue: { ring: "ring-cyan-400/60",    bg: "bg-cyan-500",     text: "text-cyan-300",    border: "border-cyan-400/50",    soft: "bg-cyan-500/10" } },
  { key: "quote_in_progress", label: "Quote drafting",  icon: FileEdit,      hue: { ring: "ring-violet-400/60",  bg: "bg-violet-500",   text: "text-violet-300",  border: "border-violet-400/50",  soft: "bg-violet-500/10" } },
  { key: "quote_sent",        label: "Quote sent",      icon: FileCheck2,    hue: { ring: "ring-indigo-400/60",  bg: "bg-indigo-500",   text: "text-indigo-300",  border: "border-indigo-400/50",  soft: "bg-indigo-500/10" } },
  { key: "approved",          label: "Approved",        icon: ThumbsUp,      hue: { ring: "ring-emerald-400/60", bg: "bg-emerald-500",  text: "text-emerald-300", border: "border-emerald-400/50", soft: "bg-emerald-500/10" } },
  { key: "waiting_parts",     label: "Waiting parts",   icon: Package,       hue: { ring: "ring-amber-400/60",   bg: "bg-amber-500",    text: "text-amber-300",   border: "border-amber-400/50",   soft: "bg-amber-500/10" } },
  { key: "in_repair",         label: "In repair",       icon: Hammer,        hue: { ring: "ring-orange-400/60",  bg: "bg-orange-500",   text: "text-orange-300",  border: "border-orange-400/50",  soft: "bg-orange-500/10" } },
  { key: "ready_for_pickup",  label: "Ready",           icon: PackageCheck,  hue: { ring: "ring-lime-400/60",    bg: "bg-lime-500",     text: "text-lime-300",    border: "border-lime-400/50",    soft: "bg-lime-500/10" } },
  { key: "closed",            label: "Closed",          icon: Archive,       hue: { ring: "ring-slate-400/60",   bg: "bg-slate-500",    text: "text-slate-300",   border: "border-slate-400/50",   soft: "bg-slate-500/10" } },
];

function PipelineFlow({
  currentStatus,
  onPick,
  next,
}: {
  currentStatus: ClaimStatus;
  onPick: (s: ClaimStatus) => void;
  next: ClaimStatus | null;
}) {
  const declined = currentStatus === "declined";
  const currentIdx = FLOW_STAGES.findIndex((s) => s.key === currentStatus);

  return (
    <section className="card-surface p-4 sm:p-5 print:hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">Claim flow</div>
          <h2 className="font-display text-lg font-semibold">Progress</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {next && !declined && (
            <Button onClick={() => onPick(next)} className="gold-surface gap-2">
              <Check className="h-4 w-4" /> Advance → {CLAIM_STATUS_META[next].label}
            </Button>
          )}
          {!declined && currentStatus !== "closed" && (
            <Button onClick={() => onPick("declined")} variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/40">
              <X className="h-3.5 w-3.5" /> Declined
            </Button>
          )}
        </div>
      </div>

      {declined && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-center gap-2">
          <X className="h-4 w-4" /> Claim was <b>declined</b> — pick a stage below to re-open.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {FLOW_STAGES.map((stage, i) => {
          const active = !declined && stage.key === currentStatus;
          const past = !declined && i < currentIdx;
          const future = declined || i > currentIdx;
          const Icon = stage.icon;

          const nodeCls = active
            ? `${stage.hue.bg} text-white ring-4 ${stage.hue.ring} shadow-lg scale-110`
            : past
              ? `${stage.hue.bg} text-white opacity-90`
              : `bg-muted text-muted-foreground border border-border`;

          const cardCls = active
            ? `${stage.hue.border} ${stage.hue.soft} shadow-[0_8px_28px_-12px_oklch(0_0_0/0.6)]`
            : past
              ? `${stage.hue.border} ${stage.hue.soft} opacity-95`
              : "border-border bg-card/40";

          return (
            <button
              key={stage.key}
              onClick={() => onPick(stage.key)}
              className={`relative group rounded-xl border p-3 text-left transition-all hover:scale-[1.02] ${cardCls}`}
            >
              {/* connector arrow to next */}
              {i < FLOW_STAGES.length - 1 && (
                <ChevronRight
                  className={`hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 ${
                    past || active ? stage.hue.text : "text-border"
                  }`}
                />
              )}
              <div className="flex items-center gap-2.5">
                <div className={`grid h-9 w-9 place-items-center rounded-full transition-all ${nodeCls}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">
                    Step {i + 1}
                  </div>
                  <div className={`text-sm font-bold leading-tight truncate ${active ? stage.hue.text : past ? stage.hue.text : "text-foreground/80"}`}>
                    {stage.label}
                  </div>
                </div>
              </div>
              {active && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> Current
                </div>
              )}
              {past && (
                <div className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${stage.hue.text}`}>
                  <Check className="h-3 w-3" /> Done
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      {!declined && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
            <span>Progress</span>
            <span>{Math.round(((currentIdx + 1) / FLOW_STAGES.length) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-500 via-emerald-500 to-lime-500 transition-all duration-500"
              style={{ width: `${((currentIdx + 1) / FLOW_STAGES.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}

