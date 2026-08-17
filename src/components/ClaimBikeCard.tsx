/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bike as BikeIcon, Pencil, Plus, Save, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Bike = {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  rego: string | null;
  vin: string | null;
  mileage: number | null;
};

/** Bike summary on an insurance claim — editable in place (rego, VIN, mileage, year/make/model). */
export function ClaimBikeCard({
  bike,
  bikeText,
  claimId,
  canEdit = true,
}: {
  bike: Bike | null | undefined;
  bikeText: string;
  claimId: string;
  canEdit?: boolean;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    year: bike?.year != null ? String(bike.year) : "",
    make: bike?.make ?? "",
    model: bike?.model ?? "",
    rego: bike?.rego ?? "",
    vin: bike?.vin ?? "",
    mileage: bike?.mileage != null ? String(bike.mileage) : "",
  });

  useEffect(() => {
    if (editing) return;
    setForm({
      year: bike?.year != null ? String(bike.year) : "",
      make: bike?.make ?? "",
      model: bike?.model ?? "",
      rego: bike?.rego ?? "",
      vin: bike?.vin ?? "",
      mileage: bike?.mileage != null ? String(bike.mileage) : "",
    });
  }, [bike?.id, bike?.year, bike?.make, bike?.model, bike?.rego, bike?.vin, bike?.mileage, editing]);

  async function save() {
    if (!bike?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("motorcycles")
        .update({
          year: form.year.trim() ? Number(form.year) : null,
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          rego: form.rego.trim() ? form.rego.trim().toUpperCase() : null,
          vin: form.vin.trim() ? form.vin.trim().toUpperCase() : null,
          mileage: form.mileage.trim() ? Number(form.mileage) : null,
        } as any)
        .eq("id", bike.id);
      if (error) throw error;
      toast.success("Bike details updated");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["insurance-claim", claimId] });
      qc.invalidateQueries({ queryKey: ["motorcycles"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save bike details");
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof typeof form, label: string, props: any = {}) => (
    <div className="space-y-1">
      <Label className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="h-8 text-xs"
        {...props}
      />
    </div>
  );

  async function assign(motorcycleId: string) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("insurance_claims")
        .update({ motorcycle_id: motorcycleId } as any)
        .eq("id", claimId);
      if (error) throw error;
      toast.success("Motorcycle linked to claim");
      setPicking(false);
      qc.invalidateQueries({ queryKey: ["insurance-claim", claimId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to link motorcycle");
    } finally {
      setSaving(false);
    }
  }

  async function createAndAssign() {
    if (!form.make.trim() && !form.model.trim() && !form.rego.trim()) {
      toast.error("Add at least make, model or rego");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("motorcycles")
        .insert({
          customer_id: customerId ?? null,
          year: form.year.trim() ? Number(form.year) : null,
          make: form.make.trim() || null,
          model: form.model.trim() || null,
          rego: form.rego.trim() ? form.rego.trim().toUpperCase() : null,
          vin: form.vin.trim() ? form.vin.trim().toUpperCase() : null,
          mileage: form.mileage.trim() ? Number(form.mileage) : null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      await assign((data as any).id);
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["motorcycles"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to create motorcycle");
      setSaving(false);
    }
  }

  async function runSearch(term: string) {
    setSearch(term);
    if (term.trim().length < 2 && !customerId) {
      setResults([]);
      return;
    }
    let q = supabase
      .from("motorcycles")
      .select("id,year,make,model,rego,vin,mileage")
      .limit(15);
    if (term.trim().length >= 2) {
      const t = `%${term.trim()}%`;
      q = q.or(`rego.ilike.${t},make.ilike.${t},model.ilike.${t},vin.ilike.${t}`);
    } else if (customerId) {
      q = q.eq("customer_id", customerId);
    }
    const { data } = await q;
    setResults((data as any[]) ?? []);
  }

  const editForm = (
    <div className="space-y-2 print:hidden">
      <div className="grid grid-cols-3 gap-2">
        {field("year", "Year", { inputMode: "numeric" })}
        {field("make", "Make")}
        {field("model", "Model")}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {field("rego", "Rego")}
        {field("vin", "VIN")}
        {field("mileage", "Odometer (km)", { inputMode: "numeric" })}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          className="gap-1.5"
          onClick={bike?.id ? save : createAndAssign}
          disabled={saving}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : bike?.id ? "Save" : "Create & link"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setEditing(false)}
          disabled={saving}
        >
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="card-surface p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-bold">
          Motorcycle
        </div>
        {canEdit && !editing && !picking && (
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => {
                setPicking(true);
                void runSearch("");
              }}
              className="inline-flex items-center gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <Search className="h-3 w-3" /> {bike?.id ? "Change" : "Assign"}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {bike?.id ? (
                <>
                  <Pencil className="h-3 w-3" /> Edit
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3" /> New
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {picking ? (
        <div className="space-y-2 print:hidden">
          <Input
            autoFocus
            placeholder="Search rego, make, model or VIN…"
            value={search}
            onChange={(e) => void runSearch(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="max-h-56 overflow-auto rounded-md border border-border divide-y divide-border">
            {results.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No motorcycles found.</div>
            ) : (
              results.map((m) => (
                <button
                  key={m.id}
                  onClick={() => void assign(m.id)}
                  disabled={saving}
                  className="w-full text-left px-3 py-2 hover:bg-muted/60 transition"
                >
                  <div className="text-xs font-semibold">
                    {[m.year, m.make, m.model].filter(Boolean).join(" ") || "—"}
                  </div>
                  <div className="text-[0.65rem] text-muted-foreground">
                    Rego {m.rego ?? "—"} · VIN {m.vin ?? "—"}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setPicking(false);
                setEditing(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> New bike
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : !editing ? (
        <>
          <div className="font-bold flex items-center gap-1.5">
            <BikeIcon className="h-4 w-4" /> {bike?.id ? bikeText : "No motorcycle linked"}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Rego {bike?.rego ?? "—"} · VIN {bike?.vin ?? "—"} · {bike?.mileage ?? "—"}km
          </div>
        </>
      ) : (
        editForm
      )}
    </div>
  );
}
