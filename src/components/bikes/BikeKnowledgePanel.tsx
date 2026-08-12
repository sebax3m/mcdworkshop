/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORIES = [
  "modification",
  "performance",
  "tune",
  "part",
  "fluid",
  "note",
];

/**
 * Knowledge that belongs to ONE motorcycle (mods, turbo, injectors, tune version,
 * dyno figures). Never promoted to model-level Garage Library knowledge.
 */
export function BikeKnowledgePanel({ motorcycleId }: { motorcycleId: string }) {
  const { isAdmin } = useCurrentUser();
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState("modification");

  const { data: rows = [] } = useQuery({
    queryKey: ["bike-knowledge", motorcycleId],
    queryFn: async () =>
      (
        await supabase
          .from("motorcycle_knowledge")
          .select("*")
          .eq("motorcycle_id", motorcycleId)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  async function add() {
    if (!label.trim()) return;
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("motorcycle_knowledge").insert({
      motorcycle_id: motorcycleId,
      category,
      label: label.trim(),
      value: value.trim() || null,
      created_by: auth.user?.id ?? null,
    } as any);
    if (error) return toast.error(error.message);
    setLabel("");
    setValue("");
    qc.invalidateQueries({ queryKey: ["bike-knowledge", motorcycleId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("motorcycle_knowledge").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["bike-knowledge", motorcycleId] });
  }

  return (
    <div className="card-surface p-4 space-y-3">
      <div className="text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1">
        <Wrench className="h-3 w-3" /> This motorcycle only
      </div>
      <p className="text-xs text-muted-foreground">
        Modifications, tuning and performance data stay on this bike — they are never applied to the
        model in the Garage Library.
      </p>

      <div className="space-y-1">
        {rows.map((r: any) => (
          <div key={r.id} className="flex items-center gap-2 text-sm border-b border-border/50 py-1.5 last:border-0">
            <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase text-muted-foreground">
              {r.category}
            </span>
            <span>{r.label}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {[r.value, r.unit].filter(Boolean).join(" ")}
            </span>
            {isAdmin && (
              <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => remove(r.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-muted-foreground">Nothing recorded yet.</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="h-9 rounded-md border border-border bg-background px-2 text-xs"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Input
          className="h-9 w-40"
          placeholder="Item (Turbo kit)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <Input
          className="h-9 w-32"
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button size="sm" className="h-9 gap-1" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}
