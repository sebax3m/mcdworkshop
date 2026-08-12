import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  generationLabel,
  linkMotorcycleToModel,
  suggestModels,
  type ModelSuggestion,
} from "@/lib/garage-catalogue";

/**
 * Suggests catalogue models for a workshop motorcycle. Nothing is linked
 * automatically — a person always confirms the match.
 */
export function ModelMatchingDialog({
  open,
  onOpenChange,
  motorcycle,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  motorcycle: { id: string; make: string | null; model: string | null; year: number | null };
  onLinked?: (modelId: string) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["model-suggestions", motorcycle.id, motorcycle.make, motorcycle.model, motorcycle.year],
    enabled: open && !!motorcycle.make && !!motorcycle.model,
    queryFn: () => suggestModels(motorcycle.make ?? "", motorcycle.model ?? "", motorcycle.year),
  });

  const bikeLabel = useMemo(
    () => [motorcycle.year, motorcycle.make, motorcycle.model].filter(Boolean).join(" "),
    [motorcycle],
  );

  async function confirm(s: ModelSuggestion) {
    setSaving(s.model_id);
    try {
      await linkMotorcycleToModel(motorcycle.id, s.model_id);
      toast.success("Motorcycle matched to the Garage Library");
      onLinked?.(s.model_id);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Match to Garage Library</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {bikeLabel || "This motorcycle"} — confirm the catalogue generation. The motorcycle record itself is never changed.
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Looking for matches…
          </div>
        ) : suggestions.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
            <Search className="mx-auto mb-2 h-4 w-4" />
            No confident match in the catalogue yet.
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.model_id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {s.make} {s.model}
                  </div>
                  <div className="font-mono text-[0.7rem] text-muted-foreground">
                    {generationLabel(s)}
                    {s.platform ? ` · ${s.platform}` : ""}
                  </div>
                </div>
                <span
                  className={`ml-auto rounded border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase ${
                    s.confidence === "matched"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {s.confidence}
                </span>
                <Button size="sm" disabled={saving !== null} onClick={() => confirm(s)}>
                  {saving === s.model_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  <span className="ml-1">Confirm</span>
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
