/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bike as BikeIcon, Pencil, Save, X } from "lucide-react";
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

  return (
    <div className="card-surface p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground font-bold">
          Motorcycle
        </div>
        {canEdit && bike?.id && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground hover:text-foreground print:hidden"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>

      {!editing ? (
        <>
          <div className="font-bold flex items-center gap-1.5">
            <BikeIcon className="h-4 w-4" /> {bikeText}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Rego {bike?.rego ?? "—"} · VIN {bike?.vin ?? "—"} · {bike?.mileage ?? "—"}km
          </div>
        </>
      ) : (
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
            <Button size="sm" className="gap-1.5" onClick={save} disabled={saving}>
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
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
      )}
    </div>
  );
}
