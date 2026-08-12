/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TECH_CATEGORIES, techCategoryLabel, techFieldLabel, toNum } from "@/lib/garage-tech";

/**
 * Bike-specific technical overrides.
 * A modified motorcycle (turbo, big-bore, aftermarket suspension) keeps its own
 * values here. These NEVER touch the shared Garage Library model data.
 */
export function BikeOverridesCard({
  motorcycleId,
  modelId,
}: {
  motorcycleId: string;
  modelId?: string | null;
}) {
  const { isAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category: "engine_oil",
    subject: "",
    field: "",
    value: "",
    unit: "",
    reason: "",
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["bike-overrides", motorcycleId],
    queryFn: async () =>
      (
        await supabase
          .from("garage_bike_overrides")
          .select("*")
          .eq("motorcycle_id", motorcycleId)
          .eq("is_archived", false)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const cat = TECH_CATEGORIES.find((c) => c.key === form.category);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.field || !form.value) throw new Error("Field and value are required");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("garage_bike_overrides").upsert(
        {
          motorcycle_id: motorcycleId,
          model_id: modelId ?? null,
          category: form.category,
          subject: form.subject,
          field: form.field,
          value_text: form.value,
          value_num: toNum(form.value),
          unit: form.unit || null,
          reason: form.reason || null,
          created_by: auth.user?.id ?? null,
        } as never,
        { onConflict: "motorcycle_id,category,subject,field" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Override saved for this bike only");
      setForm({ category: "engine_oil", subject: "", field: "", value: "", unit: "", reason: "" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["bike-overrides", motorcycleId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("garage_bike_overrides").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bike-overrides", motorcycleId] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground">
            Bike-specific overrides
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Applies to this motorcycle only — the model data in Garage Library is never changed.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Override
        </Button>
      </div>

      {open && (
        <div className="mt-3 grid gap-2 rounded border border-border/60 bg-muted/20 p-2 sm:grid-cols-3">
          <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v, field: "" }))}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TECH_CATEGORIES.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={form.field} onValueChange={(v) => setForm((f) => ({ ...f, field: v }))}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Field" />
            </SelectTrigger>
            <SelectContent>
              {(cat?.fields ?? []).map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cat?.subjectLabel && (
            <Input
              className="h-9"
              placeholder={cat.subjectLabel}
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
          )}
          <Input
            className="h-9"
            placeholder="Value"
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
          />
          <Input
            className="h-9"
            placeholder="Unit"
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
          />
          <Input
            className="h-9"
            placeholder="Reason (e.g. turbo build)"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
          <div className="sm:col-span-3">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              Save override
            </Button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No overrides — this bike follows the model data.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {(rows as any[]).map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate">
                  <span className="text-muted-foreground">{techCategoryLabel(r.category)}</span>{" "}
                  {r.subject ? `${r.subject} · ` : ""}
                  {techFieldLabel(r.category, r.field)}:{" "}
                  <span className="font-medium">
                    {r.value_text} {r.unit ?? ""}
                  </span>
                </p>
                {r.reason && (
                  <p className="flex items-center gap-1 text-xs text-amber-400">
                    <ShieldAlert className="h-3 w-3" /> {r.reason}
                  </p>
                )}
              </div>
              {isAdmin && (
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
