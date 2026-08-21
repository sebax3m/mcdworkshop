/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResearchImport } from "@/components/garage/ResearchImport";
import { techCategoryLabel, techFieldLabel } from "@/lib/garage-tech";
import {
  CONFIDENCE_TONE,
  acceptResearchResult,
  fetchResearchAnalytics,
  needsMoreResearch,
  rejectResearchResult,
  resultStatus,
  setRequestStatus,
  type ConflictChoice,
  type ResearchResult,
} from "@/lib/garage-research";

export const Route = createFileRoute("/_authenticated/garage-library/research")({
  component: ResearchPage,
  head: () => ({
    meta: [
      { title: "Research missing data · Garage Library · Motorcycle Doctors" },
      {
        name: "description",
        content:
          "Queue missing motorcycle specifications, stage external research with full source provenance and verify it before it reaches the workshop library.",
      },
      { property: "og:title", content: "Research missing data · Garage Library" },
      {
        property: "og:description",
        content: "Missing-knowledge queue, research staging and verification for Motorcycle Doctors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const head = "text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground";
const card = "rounded-lg border border-border bg-card p-3";
const dt = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("en-GB") : "—";

function ResearchPage() {
  const { isAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const [tab, setTab] = useState("queue");

  const { data: requests = [] } = useQuery({
    queryKey: ["research-requests"],
    queryFn: async () =>
      (
        await supabase
          .from("garage_research_requests")
          .select("*, bike_library_models(make, model, generation, year_from, year_to)")
          .order("priority")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const { data: results = [] } = useQuery({
    queryKey: ["research-results"],
    queryFn: async () =>
      (
        await supabase
          .from("garage_research_results")
          .select("*, bike_library_models(make, model, generation)")
          .order("created_at", { ascending: false })
          .limit(300)
      ).data ?? [],
  });

  const { data: analytics } = useQuery({
    queryKey: ["research-analytics"],
    queryFn: fetchResearchAnalytics,
  });

  const staged = (results as any[]).filter((r) => r.status === "staged");
  const reviewed = (results as any[]).filter((r) => r.status !== "staged");

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" asChild>
          <Link to="/garage-library">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Research missing data</h1>
          <p className="text-xs text-muted-foreground">
            External research never becomes verified data on its own — a person always decides.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Open requests" value={analytics?.open_requests ?? 0} />
        <Stat label="Awaiting review" value={analytics?.staged ?? 0} />
        <Stat label="Needs more research" value={analytics?.needs_more ?? 0} />
        <Stat label="Unverified specs" value={analytics?.unverified_specs ?? 0} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="queue" className="text-xs uppercase tracking-wide">
            Queue ({requests.filter((r: any) => r.status !== "closed").length})
          </TabsTrigger>
          <TabsTrigger value="staging" className="text-xs uppercase tracking-wide">
            Staging ({staged.length})
          </TabsTrigger>
          <TabsTrigger value="import" className="text-xs uppercase tracking-wide">
            Batch import
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs uppercase tracking-wide">
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-3 space-y-2">
          {requests.length === 0 && (
            <p className={card}>
              Nothing queued. Use <strong>RESEARCH</strong> on a model&apos;s missing-knowledge card to add
              requests.
            </p>
          )}
          {(requests as any[]).map((r) => {
            const m = r.bike_library_models ?? {};
            return (
              <div key={r.id} className={`${card} flex flex-wrap items-center justify-between gap-2`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {r.label}{" "}
                    <span className="text-muted-foreground">
                      · {techCategoryLabel(r.category)}
                      {r.subject ? ` · ${r.subject}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <Link to="/garage-library/$modelId" params={{ modelId: r.model_id }} className="hover:underline">
                      {m.make} {m.model} {m.generation ? `· ${m.generation}` : ""}
                      {m.year_from ? ` (${m.year_from}–${m.year_to ?? "on"})` : ""}
                    </Link>
                    {r.note ? ` · ${r.note}` : ""} · raised {dt(r.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={head}>{r.status}</span>
                  <Select
                    value={r.status}
                    onValueChange={async (v) => {
                      await setRequestStatus(r.id, v);
                      qc.invalidateQueries({ queryKey: ["research-requests"] });
                      qc.invalidateQueries({ queryKey: ["research-analytics"] });
                    }}
                  >
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="researching">Researching</SelectItem>
                      <SelectItem value="answered">Answered</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="staging" className="mt-3 space-y-2">
          {staged.length === 0 && <p className={card}>No researched values waiting for review.</p>}
          {staged.map((r) => (
            <StagedRow key={r.id} row={r} isAdmin={isAdmin} />
          ))}

          {reviewed.length > 0 && (
            <div className={card}>
              <p className={head}>Recent decisions</p>
              <ul className="mt-2 space-y-1 text-sm">
                {reviewed.slice(0, 15).map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate">
                      {r.bike_library_models?.make} {r.bike_library_models?.model} ·{" "}
                      {techFieldLabel(r.category, r.field)}: {r.value_text} {r.unit ?? ""}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[0.6rem] font-mono uppercase ${resultStatus(r.status).tone}`}
                    >
                      {resultStatus(r.status).label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="import" className="mt-3">
          <ResearchImport onImported={() => setTab("staging")} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-3 grid gap-3 md:grid-cols-3">
          <div className={card}>
            <p className={head}>Models missing most data</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(analytics?.top_missing_models ?? []).length === 0 && (
                <li className="text-muted-foreground">Nothing queued</li>
              )}
              {(analytics?.top_missing_models ?? []).map((m) => (
                <li key={m.model_id} className="flex justify-between gap-2">
                  <Link
                    to="/garage-library/$modelId"
                    params={{ modelId: m.model_id }}
                    className="truncate hover:underline"
                  >
                    {m.make} {m.model} {m.generation ? `· ${m.generation}` : ""}
                  </Link>
                  <span className="font-mono text-xs text-muted-foreground">{m.requests}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={card}>
            <p className={head}>Most requested specs</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(analytics?.top_missing_fields ?? []).length === 0 && (
                <li className="text-muted-foreground">Nothing queued</li>
              )}
              {(analytics?.top_missing_fields ?? []).map((f) => (
                <li key={`${f.category}-${f.field}`} className="flex justify-between gap-2">
                  <span className="truncate">{techFieldLabel(f.category, f.field)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{f.requests}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={card}>
            <p className={head}>Recently verified</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(analytics?.recently_verified ?? []).length === 0 && (
                <li className="text-muted-foreground">Nothing verified yet</li>
              )}
              {(analytics?.recently_verified ?? []).map((s) => (
                <li key={s.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {s.make} {s.model} · {techFieldLabel(s.category, s.field)}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{dt(s.verified_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={card}>
      <p className={head}>{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none">{value}</p>
    </div>
  );
}

function StagedRow({ row, isAdmin }: { row: any; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [conflict, setConflict] = useState<ConflictChoice>(row.conflict_spec_id ? "add_alternative" : "replace_existing");

  const act = useMutation({
    mutationFn: async (kind: "unverified" | "verified" | "reject" | "more") => {
      const result = row as ResearchResult;
      if (kind === "reject") return rejectResearchResult(result.id, note || null);
      if (kind === "more") return needsMoreResearch(result.id, note || null);
      return acceptResearchResult(result, kind, { conflict, note: note || null });
    },
    onSuccess: () => {
      toast.success("Decision recorded");
      qc.invalidateQueries({ queryKey: ["research-results"] });
      qc.invalidateQueries({ queryKey: ["research-analytics"] });
      qc.invalidateQueries({ queryKey: ["tech-specs-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const m = row.bike_library_models ?? {};
  const warnings: string[] = Array.isArray(row.warnings) ? row.warnings : [];

  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {techCategoryLabel(row.category)}
            {row.subject ? ` · ${row.subject}` : ""} · {techFieldLabel(row.category, row.field)}
          </p>
          <p className="text-xs text-muted-foreground">
            <Link to="/garage-library/$modelId" params={{ modelId: row.model_id }} className="hover:underline">
              {m.make} {m.model} {m.generation ? `· ${m.generation}` : ""}
            </Link>{" "}
            · match: {row.model_match} · {row.origin === "chatgpt_import" ? "curated import" : "manual research"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded border px-1.5 py-0.5 text-[0.6rem] font-mono uppercase ${CONFIDENCE_TONE[row.confidence]}`}>
            {row.confidence} confidence
          </span>
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <div className="rounded border border-border/60 bg-muted/20 p-2">
          <p className={head}>Proposed value</p>
          <p className="text-lg font-semibold leading-tight">
            {row.value_text} {row.unit ?? ""}
          </p>
        </div>
        <div className="rounded border border-border/60 bg-muted/20 p-2">
          <p className={head}>Source</p>
          <p className="text-sm">{row.source_name ?? "Unnamed source"}</p>
          <p className="text-xs text-muted-foreground">
            {row.source_type} {row.source_ref ? `· ${row.source_ref}` : ""}
            {row.source_url ? ` · ${row.source_url}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            Accessed {dt(row.accessed_at)}
            {row.source_date ? ` · document ${dt(row.source_date)}` : ""}
          </p>
        </div>
        <div className="rounded border border-border/60 bg-muted/20 p-2">
          <p className={head}>Warnings</p>
          {warnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">None</p>
          ) : (
            <ul className="list-disc pl-4 text-xs text-amber-400">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {row.conflict_spec_id && (
        <div className="mt-2">
          <p className={head}>Conflict resolution (required — stored value will not be overwritten silently)</p>
          <Select value={conflict} onValueChange={(v) => setConflict(v as ConflictChoice)}>
            <SelectTrigger className="mt-1 h-8 w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep_existing">Keep existing value</SelectItem>
              <SelectItem value="add_alternative">Add as alternative</SelectItem>
              <SelectItem value="replace_existing">Replace existing value</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Input
        className="mt-2 h-9"
        placeholder="Decision note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => act.mutate("unverified")} disabled={act.isPending}>
          {act.isPending && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          Accept unverified
        </Button>
        <Button size="sm" onClick={() => act.mutate("verified")} disabled={act.isPending || !isAdmin}>
          Verify &amp; accept
        </Button>
        <Button size="sm" variant="ghost" onClick={() => act.mutate("more")} disabled={act.isPending}>
          <Search className="mr-1 h-3.5 w-3.5" /> Needs more research
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => act.mutate("reject")} disabled={act.isPending}>
          Reject
        </Button>
      </div>
      {!isAdmin && (
        <p className="mt-1 text-[0.65rem] text-muted-foreground">
          Verify &amp; accept is limited to admins — technicians can accept as unverified.
        </p>
      )}
    </div>
  );
}
