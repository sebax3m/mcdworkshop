import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchAllRows } from "@/lib/fetch-all";
import { TechVerificationBadge } from "@/components/garage/TechSpecsTab";
import {
  TECH_VERIFICATIONS,
  specValue,
  techCategoryLabel,
  techFieldLabel,
  techSourceLabel,
  type TechSpec,
} from "@/lib/garage-tech";

export const Route = createFileRoute("/_authenticated/garage-library/review")({
  component: DataReviewPage,
  head: () => ({
    meta: [
      { title: "Data Review | Garage Library" },
      { name: "description", content: "Review imported motorcycle technical data: new imports, unverified values, conflicts and missing sources." },
      { property: "og:title", content: "Data Review | Garage Library" },
      { property: "og:description", content: "Verify, correct and approve technical specifications before technicians rely on them." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type SpecWithModel = TechSpec & { model?: { make: string; model: string; generation: string | null; year_from: number | null; year_to: number | null } | null };

const TABS = [
  { key: "new", label: "New imports" },
  { key: "unverified", label: "Unverified" },
  { key: "conflicts", label: "Conflicts" },
  { key: "missing_source", label: "Missing source" },
  { key: "needs_verification", label: "Needs verification" },
] as const;

function DataReviewPage() {
  const { user } = useCurrentUser();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("new");

  const { data: specs = [], isLoading } = useQuery({
    queryKey: ["tech-review"],
    queryFn: async () =>
      fetchAllRows<SpecWithModel>((from, to) =>
        supabase
          .from("garage_tech_specs")
          .select("*, model:bike_library_models(make, model, generation, year_from, year_to)")
          .eq("is_archived", false)
          .order("updated_at", { ascending: false })
          .range(from, to) as never,
      ),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("garage_tech_specs").update({ ...patch, updated_by: user?.id ?? null } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tech-review"] });
      qc.invalidateQueries({ queryKey: ["garage-model"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const buckets = useMemo(() => {
    const safety = (s: SpecWithModel) => ["torque", "valves", "engine_oil", "fluids", "brakes", "tyres"].includes(s.category);
    return {
      new: specs.filter((s) => s.review_status === "new_import"),
      unverified: specs.filter((s) => s.verification === "unverified"),
      conflicts: specs.filter((s) => s.review_status === "needs_review" || s.is_alternative),
      missing_source: specs.filter((s) => !s.source_name),
      needs_verification: specs.filter((s) => safety(s) && s.verification === "unverified"),
    } as Record<string, SpecWithModel[]>;
  }, [specs]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
      <Link to="/garage-library" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Garage Library
      </Link>
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Data review</h1>
        <p className="text-xs text-muted-foreground">Technical values waiting for a human decision. Nothing here is trusted until it is verified.</p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="text-xs uppercase tracking-wide">
              {t.label}
              <span className="ml-1 opacity-60">{buckets[t.key]?.length ?? 0}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            <div className="rounded-lg border border-border bg-card">
              {isLoading ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Loading…</p>
              ) : (buckets[t.key] ?? []).length === 0 ? (
                <p className="px-4 py-4 text-sm text-muted-foreground">Nothing in this queue.</p>
              ) : (
                (buckets[t.key] ?? []).slice(0, 300).map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-2 text-sm last:border-0">
                    <Link to="/garage-library/$modelId" params={{ modelId: s.model_id }} className="font-medium hover:underline">
                      {s.model ? `${s.model.make} ${s.model.model}${s.model.generation ? ` · ${s.model.generation}` : ""}` : "Model"}
                    </Link>
                    <span className="font-mono text-xs text-muted-foreground">
                      {techCategoryLabel(s.category)}
                      {s.subject ? ` · ${s.subject}` : ""} · {techFieldLabel(s.category, s.field)}
                    </span>
                    <span className="font-mono text-xs font-medium">{specValue(s)}</span>
                    {s.is_alternative ? <span className="rounded border border-border px-1 text-[0.55rem] uppercase text-muted-foreground">alternative</span> : null}
                    <TechVerificationBadge value={s.verification} />
                    <span className="text-[0.65rem] text-muted-foreground">{techSourceLabel(s.source_type)}{s.source_name ? ` · ${s.source_name}` : " · no source"}</span>
                    <div className="ml-auto flex items-center gap-2">
                      <Select
                        value={s.verification}
                        onValueChange={(v) =>
                          update.mutate({
                            id: s.id,
                            patch: {
                              verification: v,
                              verified_by: v === "unverified" ? null : user?.id ?? null,
                              verified_at: v === "unverified" ? null : new Date().toISOString(),
                            },
                          })
                        }
                      >
                        <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TECH_VERIFICATIONS.map((v) => (
                            <SelectItem key={v.value} value={v.value} className="text-xs">{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" onClick={() => update.mutate({ id: s.id, patch: { review_status: "ok" } })} disabled={s.review_status === "ok"}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Reviewed
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
