/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Inbox, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { logRevision, modelTitle, yearLabel } from "@/lib/garage-library";
import { PROPOSAL_CATEGORIES } from "@/lib/garage-learning";

export const Route = createFileRoute("/_authenticated/garage-library/updates")({
  component: KnowledgeUpdates,
  head: () => ({
    meta: [
      { title: "Knowledge Updates | Garage Library" },
      {
        name: "description",
        content:
          "Approval queue for Garage Library learning: labour, parts, fluids, technical specs and workshop notes proposed from real jobs.",
      },
      { property: "og:title", content: "Knowledge Updates | Garage Library" },
      {
        property: "og:description",
        content: "Review and approve workshop knowledge suggested by completed jobs and technicians.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const cardCls = "rounded-lg border border-border bg-card";

function KnowledgeUpdates() {
  const { isAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const [cat, setCat] = useState<string>("all");
  const [status, setStatus] = useState<"pending" | "resolved">("pending");

  const { data: proposals = [] } = useQuery({
    queryKey: ["garage-proposals", status],
    queryFn: async () => {
      let q = supabase
        .from("garage_update_proposals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      q = status === "pending" ? q.eq("status", "pending") : q.neq("status", "pending");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: models = [] } = useQuery({
    queryKey: ["garage-models-min"],
    queryFn: async () =>
      (await supabase.from("bike_library_models").select("id, make, model, year_from, year_to")).data ??
      [],
  });
  const modelById = useMemo(() => new Map((models as any[]).map((m) => [m.id, m])), [models]);

  const resolve = useMutation({
    mutationFn: async ({
      id,
      decision,
    }: {
      id: string;
      decision: "approved" | "rejected" | "kept_both";
    }) => {
      if (!isAdmin) throw new Error("Only admins can resolve knowledge updates");
      const p: any = (proposals as any[]).find((x) => x.id === id);
      if (!p) return;
      const { data: auth } = await supabase.auth.getUser();

      if (decision === "approved" && p.entity_id && p.field) {
        const n = Number(p.proposed_value);
        const value = Number.isFinite(n) && String(p.proposed_value).trim() !== "" ? n : p.proposed_value;
        const { error } = await supabase
          .from(p.entity_table as "bike_library_labour")
          .update({ [p.field]: value } as never)
          .eq("id", p.entity_id);
        if (error) throw error;
      }

      const { error: upErr } = await supabase
        .from("garage_update_proposals")
        .update({
          status: decision,
          resolved_by: auth.user?.id ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (upErr) throw upErr;

      await logRevision({
        modelId: p.model_id,
        entityTable: p.entity_table,
        entityId: p.entity_id,
        field: p.field,
        label: p.label,
        oldValue: p.current_value,
        newValue: decision === "approved" ? p.proposed_value : null,
        action: decision === "approved" ? "update" : "verify",
        note: `Knowledge update ${decision}${p.evidence_count ? ` · ${p.evidence_count} jobs` : ""}`,
      });
    },
    onSuccess: () => {
      toast.success("Knowledge update resolved");
      qc.invalidateQueries({ queryKey: ["garage-proposals"] });
      qc.invalidateQueries({ queryKey: ["garage-recent"] });
      qc.invalidateQueries({ queryKey: ["garage-model"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (proposals as any[]).filter((p) => cat === "all" || (p.category ?? "other") === cat);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-5">
      <Link
        to="/garage-library"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Garage Library
      </Link>

      <header className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg border border-border bg-card">
          <Inbox className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Knowledge Updates</h1>
          <p className="text-xs text-muted-foreground">
            Workshop learning waits here. Nothing changes the library until an Admin approves it.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {[{ value: "all", label: "All" }, ...PROPOSAL_CATEGORIES].map((c) => (
          <Button
            key={c.value}
            size="sm"
            variant={cat === c.value ? "default" : "outline"}
            onClick={() => setCat(c.value)}
          >
            {c.label}
          </Button>
        ))}
        <span className="ml-auto" />
        <Button
          size="sm"
          variant={status === "pending" ? "default" : "outline"}
          onClick={() => setStatus("pending")}
        >
          Pending
        </Button>
        <Button
          size="sm"
          variant={status === "resolved" ? "default" : "outline"}
          onClick={() => setStatus("resolved")}
        >
          Resolved
        </Button>
      </div>

      <section className={cardCls}>
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Nothing in this queue.</p>
        ) : (
          filtered.map((p: any) => {
            const m = modelById.get(p.model_id);
            return (
              <div key={p.id} className="px-4 py-3 border-b border-border/60 last:border-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-muted-foreground">
                    {p.category ?? "other"}
                  </span>
                  {m && (
                    <Link
                      to="/garage-library/$modelId"
                      params={{ modelId: p.model_id }}
                      className="text-sm font-medium hover:underline"
                    >
                      {modelTitle(m)} {yearLabel(m)}
                    </Link>
                  )}
                  <span className="text-sm">{p.label}</span>
                  {p.evidence_count > 0 && (
                    <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-emerald-400">
                      {p.evidence_count} jobs
                    </span>
                  )}
                  {p.status !== "pending" && (
                    <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-muted-foreground">
                      {p.status}
                    </span>
                  )}
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  Current: {p.current_value ?? "—"} → Proposed: {p.proposed_value}
                  {p.unit ? ` ${p.unit}` : ""}
                </div>
                {p.note && <div className="text-xs text-muted-foreground">{p.note}</div>}
                <div className="font-mono text-[0.65rem] text-muted-foreground">
                  {new Date(p.created_at).toLocaleString("en-GB")} · source {p.source}
                </div>
                {p.status === "pending" && isAdmin && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => resolve.mutate({ id: p.id, decision: "approved" })}>
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Approve update
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolve.mutate({ id: p.id, decision: "rejected" })}
                    >
                      Keep current
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => resolve.mutate({ id: p.id, decision: "kept_both" })}
                    >
                      Save as alternative
                    </Button>
                  </div>
                )}
                {p.status === "pending" && !isAdmin && (
                  <div className="text-xs text-muted-foreground">Waiting for Admin approval.</div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
