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
import { ClaimDamageSection } from "@/components/ClaimDamageSection";

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
          "*, customers(id,first_name,last_name,phone,email), motorcycles(id,year,make,model,rego,vin,mileage), jobs(id,job_number,title,status)",
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
    // Build quote summary from current quote_items so the technician sees
    // exactly which parts to replace/repair and the labour budget.
    const items: Array<{ kind: "part" | "labour"; item_code?: string; item_name?: string; description: string; qty: number; unit_price: number }> =
      Array.isArray(c.quote_items) ? c.quote_items : [];
    const label = (it: { item_code?: string; item_name?: string; description: string }) => {
      const code = (it.item_code ?? "").trim();
      const name = (it.item_name ?? "").trim();
      const desc = (it.description ?? "").trim();
      return [code && `[${code}]`, name || desc, name && desc ? `— ${desc}` : ""].filter(Boolean).join(" ").trim();
    };
    const parts = items.filter((it) => it.kind === "part" && label(it));
    const labours = items.filter((it) => it.kind === "labour" && label(it));
    const estimatedHours = labours.reduce((s, it) => s + (Number(it.qty) || 0), 0);

    const lines: string[] = [];
    lines.push(`Insurance claim ${c.claim_number}${c.insurer_name ? ` · ${c.insurer_name}` : ""}`);
    if (parts.length) {
      lines.push("", "PARTS TO REPLACE / REPAIR:");
      for (const p of parts) {
        lines.push(`  • ${label(p)}${Number(p.qty) > 1 ? ` ×${p.qty}` : ""}`);
      }
    }
    if (labours.length) {
      lines.push("", `LABOUR (est. ${estimatedHours.toFixed(2)} hrs):`);
      for (const l of labours) {
        lines.push(`  • ${label(l)} — ${Number(l.qty).toFixed(2)} hrs`);
      }
    }
    const description = lines.join("\n");

    const title = `Collision Repair — ${c.claim_number}`;
    const { data: job, error } = await supabase
      .from("jobs")
      .insert({
        customer_id: c.customer_id,
        motorcycle_id: c.motorcycle_id,
        title,
        description,
        complaint: c.notes ?? null,
        status: "new",
        estimated_hours: estimatedHours > 0 ? estimatedHours : null,
      } as any)
      .select("id")
      .single();
    if (error) return toast.error(error.message);

    // Seed checklist tasks so the technician can tick each item as completed.
    const tasks: Array<{ job_id: string; label: string; sort_order: number; note: string | null }> = [];
    let order = 0;
    for (const p of parts) {
      tasks.push({
        job_id: job.id,
        label: `Replace / repair: ${label(p)}${Number(p.qty) > 1 ? ` ×${p.qty}` : ""}`,
        sort_order: order++,
        note: "Part (from insurance quote)",
      });
    }
    for (const l of labours) {
      tasks.push({
        job_id: job.id,
        label: `${label(l)} (${Number(l.qty).toFixed(2)} hrs est.)`,
        sort_order: order++,
        note: "Labour (from insurance quote)",
      });
    }
    if (tasks.length) {
      const { error: tErr } = await supabase.from("job_tasks").insert(tasks as any);
      if (tErr) toast.error(`Job created, but tasks failed: ${tErr.message}`);
    }

    await updateClaim({ job_id: job.id, status: "quote_in_progress" });
    toast.success(
      tasks.length
        ? `Job card created with ${tasks.length} task${tasks.length === 1 ? "" : "s"} from quote`
        : "Quote job card created",
    );
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
            Rego {c.motorcycles?.rego ?? "—"} · VIN {c.motorcycles?.vin ?? "—"} · {c.motorcycles?.mileage ?? "—"}km
          </div>
        </div>
      </section>

      <ClaimInsurerCard c={c} onUpdate={updateClaim} />

      <ClaimCustodyCard c={c} onUpdate={updateClaim} />

      <ClaimDamageSection
        claimId={claimId}
        canEdit={true}
        initialMarks={Array.isArray(c.damage_marks) ? c.damage_marks : []}
      />

      {/* Quotation builder (parts + labour) */}
      <QuoteBuilder
        c={c}
        bikeText={bikeText}
        onUpdate={updateClaim}
        onMarkSent={markSent}
        onApprove={() => setStatus("approved")}
        onDecline={() => setStatus("declined")}
        onStartJob={startQuote}
      />


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

import { Plus, Trash, Hash } from "lucide-react";
import { CRASH_PARTS, PART_CATEGORIES, LABOUR_PRESETS, type DamageLevel } from "@/lib/crash-parts";

type QuoteItem = {
  id: string;
  kind: "part" | "labour";
  item_code?: string;
  item_name?: string;
  description: string;
  qty: number; // qty for parts, hours for labour
  unit_price: number; // $ per unit / $ per hour
};

function newItem(kind: QuoteItem["kind"], unit_price = 0): QuoteItem {
  return {
    id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
    kind,
    item_code: "",
    item_name: "",
    description: "",
    qty: kind === "labour" ? 1 : 1,
    unit_price,
  };
}

function QuoteBuilder({
  c, bikeText, onUpdate, onMarkSent, onApprove, onDecline, onStartJob,
}: {
  c: any; bikeText: string;
  onUpdate: (p: any) => any;
  onMarkSent: () => void;
  onApprove: () => void;
  onDecline: () => void;
  onStartJob: () => void;
}) {
  const initial: QuoteItem[] = Array.isArray(c.quote_items) ? c.quote_items : [];
  const [items, setItems] = useState<QuoteItem[]>(initial);
  const [rate, setRate] = useState<number>(Number(c.quote_labour_rate ?? 110));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  const gst = subtotal * 0.15;
  const total = subtotal + gst;

  function patch(id: string, p: Partial<QuoteItem>) {
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, ...p } : it)));
    setDirty(true);
  }
  function remove(id: string) {
    setItems((arr) => arr.filter((it) => it.id !== id));
    setDirty(true);
  }
  function addPart() {
    setItems((arr) => [...arr, newItem("part")]);
    setDirty(true);
  }
  function addLabour() {
    setItems((arr) => [...arr, newItem("labour", rate)]);
    setDirty(true);
  }

  const [quickCat, setQuickCat] = useState<string>(PART_CATEGORIES[0]);
  const [damageLevel, setDamageLevel] = useState<DamageLevel>("moderate");

  function quickAddPart(p: (typeof CRASH_PARTS)[number]) {
    const partItem: QuoteItem = {
      id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
      kind: "part",
      item_code: "",
      item_name: p.name,
      description: "",
      qty: 1,
      unit_price: p.estPrice,
    };
    const hrs = p.labourHrs[damageLevel];
    const labourItem: QuoteItem = {
      id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
      kind: "labour",
      item_code: "",
      item_name: `R&R ${p.name}`,
      description: `Damage level: ${damageLevel}`,
      qty: hrs,
      unit_price: rate,
    };
    setItems((arr) => [...arr, partItem, labourItem]);
    setDirty(true);
  }

  function quickAddLabour(preset: (typeof LABOUR_PRESETS)[number]) {
    setItems((arr) => [...arr, {
      id: (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)),
      kind: "labour",
      item_code: "",
      item_name: preset.name,
      description: "",
      qty: preset.hrs,
      unit_price: rate,
    }]);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      await onUpdate({
        quote_items: items,
        quote_amount: Number(total.toFixed(2)),
        quote_labour_rate: rate || null,
      });
      setDirty(false);
      toast.success("Quote saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card-surface p-4 sm:p-5 border-l-4 border-primary/60 print:break-inside-avoid print:border-0">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-bold">Quotation</div>
            <h2 className="font-display text-lg font-semibold">Parts & labour estimate</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Labour $/hr</Label>
            <Input
              type="number" step="1" min="0"
              value={rate}
              onChange={(e) => { setRate(Number(e.target.value) || 0); setDirty(true); }}
              className="w-20 h-8 text-sm"
            />
          </div>
          {dirty && (
            <Button onClick={save} disabled={saving} size="sm" className="gold-surface gap-2">
              <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save quote"}
            </Button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-y-1">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-2 w-20">Type</th>
              <th className="text-left py-2 pr-2 w-28">Item code</th>
              <th className="text-left py-2 pr-2 w-48">Item name</th>
              <th className="text-left py-2 pr-2">Description</th>
              <th className="text-right py-2 px-2 w-20">Qty/Hrs</th>
              <th className="text-right py-2 px-2 w-24">Unit $</th>
              <th className="text-right py-2 pl-2 pr-3 w-28">Line $</th>
              <th className="w-10 print:hidden" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                No line items yet. Add parts or labour below.
              </td></tr>
            )}
            {items.map((it) => {
              const line = (Number(it.qty) || 0) * (Number(it.unit_price) || 0);
              return (
                <tr key={it.id} className="border-b border-border/50 align-middle">
                  <td className="py-1.5 pr-2">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      it.kind === "labour" ? "border-blue-500/40 bg-blue-500/10 text-blue-400" : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                    }`}>
                      {it.kind}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      value={it.item_code ?? ""}
                      onChange={(e) => patch(it.id, { item_code: e.target.value })}
                      placeholder="OEM #"
                      className="h-8 text-sm font-mono print:border-0 print:bg-transparent print:px-0"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      value={it.item_name ?? ""}
                      onChange={(e) => patch(it.id, { item_name: e.target.value })}
                      placeholder={it.kind === "labour" ? "Labour task" : "Part name"}
                      className="h-8 text-sm print:border-0 print:bg-transparent print:px-0"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Input
                      value={it.description}
                      onChange={(e) => patch(it.id, { description: e.target.value })}
                      placeholder={it.kind === "labour" ? "Notes, severity, paint blend…" : "Details / condition / fitment"}
                      className="h-8 text-sm print:border-0 print:bg-transparent print:px-0"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      type="number" step="0.25" min="0"
                      value={it.qty}
                      onChange={(e) => patch(it.id, { qty: Number(e.target.value) || 0 })}
                      className="h-8 text-sm text-right tabular-nums"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <Input
                      type="number" step="0.01" min="0"
                      value={it.unit_price}
                      onChange={(e) => patch(it.id, { unit_price: Number(e.target.value) || 0 })}
                      className="h-8 text-sm text-right tabular-nums"
                    />
                  </td>
                  <td className="py-1.5 pl-3 pr-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                    ${line.toFixed(2)}
                  </td>
                  <td className="py-1.5 pl-2 pr-1 print:hidden" style={{ width: 36 }}>
                    <button onClick={() => remove(it.id)} className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50">
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </td>

                </tr>
              );
            })}
          </tbody>
          <tfoot className="text-sm">
            <tr>
              <td colSpan={6} className="pt-3 pr-3 text-right text-muted-foreground">Subtotal</td>
              <td className="pt-3 pl-2 pr-3 text-right font-mono tabular-nums whitespace-nowrap">${subtotal.toFixed(2)}</td>
              <td className="print:hidden" />
            </tr>
            <tr>
              <td colSpan={6} className="pr-3 text-right text-muted-foreground">GST (15%)</td>
              <td className="pl-2 pr-3 text-right font-mono tabular-nums whitespace-nowrap">${gst.toFixed(2)}</td>
              <td className="print:hidden" />
            </tr>
            <tr className="border-t border-border">
              <td colSpan={6} className="pt-2 pr-3 text-right font-bold uppercase tracking-wider text-xs">Quote total</td>
              <td className="pt-2 pl-2 pr-3 text-right font-mono font-bold text-base tabular-nums text-primary whitespace-nowrap">${total.toFixed(2)}</td>
              <td className="print:hidden" />
            </tr>
          </tfoot>
        </table>
      </div>


      {/* Quick add catalog */}
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 print:hidden">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Quick add — crash parts</div>
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Damage</Label>
            {(["minor","moderate","severe"] as DamageLevel[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setDamageLevel(lvl)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                  damageLevel === lvl
                    ? lvl === "minor" ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                    : lvl === "moderate" ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                    : "bg-red-500/20 border-red-500/50 text-red-400"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >{lvl}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {PART_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setQuickCat(cat)}
              className={`px-2.5 py-1 rounded-md text-xs border ${
                quickCat === cat ? "bg-primary/15 border-primary/50 text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >{cat}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CRASH_PARTS.filter((p) => p.category === quickCat).map((p) => {
            const hrs = p.labourHrs[damageLevel];
            return (
              <button
                key={p.id}
                onClick={() => quickAddPart(p)}
                className="group inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs hover:border-primary/60 hover:bg-primary/5 transition"
                title={`Adds part $${p.estPrice} + ${hrs}h labour`}
              >
                <Plus className="h-3 w-3 text-primary" />
                <span className="font-medium">{p.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">${p.estPrice} · {hrs}h</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 pt-3 border-t border-border/60">
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2">Quick add — labour bundles</div>
          <div className="flex flex-wrap gap-1.5">
            {LABOUR_PRESETS.map((l) => (
              <button
                key={l.id}
                onClick={() => quickAddLabour(l)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs hover:border-blue-500/50 hover:bg-blue-500/5 transition"
              >
                <Plus className="h-3 w-3 text-blue-400" />
                <span className="font-medium">{l.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{l.hrs}h</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
        <Button onClick={addPart} variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add part
        </Button>
        <Button onClick={addLabour} variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add labour
        </Button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Label className="text-[10px] uppercase tracking-wider">Approved $</Label>
            <Input
              type="number" step="0.01"
              defaultValue={c.approved_amount ?? ""}
              onBlur={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                if (v !== (c.approved_amount ?? null)) onUpdate({ approved_amount: v });
              }}
              className="w-28 h-8 text-sm"
              placeholder="0.00"
            />
          </div>

          {c.status !== "quote_sent" && c.status !== "approved" && c.status !== "declined" && (
            <Button onClick={onMarkSent} size="sm" className="gold-surface gap-2">
              <Send className="h-3.5 w-3.5" /> Mark sent
            </Button>
          )}
          {c.status === "quote_sent" && (
            <>
              <Button onClick={onApprove} size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <Check className="h-3.5 w-3.5" /> Approved
              </Button>
              <Button onClick={onDecline} variant="outline" size="sm" className="gap-2 text-destructive border-destructive/40">
                <X className="h-3.5 w-3.5" /> Declined
              </Button>
            </>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={async () => {
              const t = toast.loading("Building PDF with photos & diagram…");
              try {
                const { buildClaimPdf } = await import("@/lib/claim-pdf");
                const { data: fresh } = await (supabase as any)
                  .from("insurance_claims")
                  .select("damage_marks")
                  .eq("id", c.id)
                  .maybeSingle();
                const liveMarks = Array.isArray(fresh?.damage_marks)
                  ? fresh.damage_marks
                  : Array.isArray(c.damage_marks) ? c.damage_marks : [];
                const blob = await buildClaimPdf({
                  claim: c,
                  bikeText,
                  marks: liveMarks as any,
                  items,
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Claim-${c.claim_number}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                toast.success("PDF downloaded", { id: t });
              } catch (e: any) {
                toast.error(e?.message ?? "Failed to generate PDF", { id: t });
              }
            }}
          >
            <Printer className="h-3.5 w-3.5" /> Download PDF
          </Button>


        </div>
      </div>

      {/* Workshop side */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2 flex-wrap print:hidden">
        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
        {c.job_id ? (
          <Link
            to="/jobs/$jobId"
            params={{ jobId: c.job_id }}
            className="text-xs font-semibold inline-flex items-center gap-1.5 hover:underline"
          >
            Open linked job card #{c.jobs?.job_number} <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">Ready for the workshop?</span>
            <button onClick={onStartJob} className="text-xs font-semibold text-primary hover:underline">
              Create Collision Repair job card
            </button>
          </>
        )}
      </div>
    </section>
  );
}



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
  const location: "workshop" | "customer" = c.bike_with_customer ? "customer" : "workshop";
  return (
    <section className="card-surface p-4 space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Bike custody</div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onUpdate({
            bike_with_customer: false,
            workshop_entry_date: c.workshop_entry_date ?? new Date().toISOString().slice(0, 10),
            expected_return_date: null,
          })}
          className={`px-3 py-2 rounded-md text-sm border ${location === "workshop" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
        >
          In workshop
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ bike_with_customer: true })}
          className={`px-3 py-2 rounded-md text-sm border ${location === "customer" ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
        >
          With customer
        </button>
      </div>
      {location === "workshop" && (
        <div className="max-w-xs">
          <Label>Date entered workshop</Label>
          <Input
            type="date"
            defaultValue={c.workshop_entry_date ?? ""}
            onBlur={(e) => e.target.value !== (c.workshop_entry_date ?? "") && onUpdate({ workshop_entry_date: e.target.value || null })}
          />
        </div>
      )}
      {location === "customer" && (
        <div className="max-w-xs">
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
    <div id="claim-print-area" className="hidden print:block">
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
      {Array.isArray(c.quote_items) && c.quote_items.length > 0 && (() => {
        const items = c.quote_items as Array<{ kind: string; item_code?: string; item_name?: string; description: string; qty: number; unit_price: number }>;
        const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
        const gst = subtotal * 0.15;
        return (
          <table className="w-full text-xs border border-gray-400 border-collapse mb-3">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-400 text-left px-2 py-1 w-14">Type</th>
                <th className="border border-gray-400 text-left px-2 py-1 w-20">Item code</th>
                <th className="border border-gray-400 text-left px-2 py-1 w-40">Item name</th>
                <th className="border border-gray-400 text-left px-2 py-1">Description</th>
                <th className="border border-gray-400 text-right px-2 py-1 w-12">Qty</th>
                <th className="border border-gray-400 text-right px-2 py-1 w-20">Unit $</th>
                <th className="border border-gray-400 text-right px-2 py-1 w-20">Line $</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="border border-gray-400 px-2 py-1 capitalize">{it.kind}</td>
                  <td className="border border-gray-400 px-2 py-1 font-mono">{it.item_code || "—"}</td>
                  <td className="border border-gray-400 px-2 py-1">{it.item_name || "—"}</td>
                  <td className="border border-gray-400 px-2 py-1">{it.description || "—"}</td>
                  <td className="border border-gray-400 px-2 py-1 text-right font-mono">{Number(it.qty).toFixed(2)}</td>
                  <td className="border border-gray-400 px-2 py-1 text-right font-mono">${Number(it.unit_price).toFixed(2)}</td>
                  <td className="border border-gray-400 px-2 py-1 text-right font-mono">${((Number(it.qty)||0)*(Number(it.unit_price)||0)).toFixed(2)}</td>
                </tr>
              ))}
              <tr><td colSpan={6} className="border border-gray-400 px-2 py-1 text-right">Subtotal</td><td className="border border-gray-400 px-2 py-1 text-right font-mono">${subtotal.toFixed(2)}</td></tr>
              <tr><td colSpan={6} className="border border-gray-400 px-2 py-1 text-right">GST (15%)</td><td className="border border-gray-400 px-2 py-1 text-right font-mono">${gst.toFixed(2)}</td></tr>
              <tr className="bg-gray-100"><td colSpan={6} className="border border-gray-400 px-2 py-1 text-right font-bold">Total (incl. GST)</td><td className="border border-gray-400 px-2 py-1 text-right font-mono font-bold">${(subtotal+gst).toFixed(2)}</td></tr>
            </tbody>
          </table>
        );
      })()}
      <div className="text-xs">
        <b>Quote total:</b> <span className="font-mono">${c.quote_amount != null ? Number(c.quote_amount).toFixed(2) : "_______"}</span>
      </div>

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

