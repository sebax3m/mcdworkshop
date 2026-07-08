import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike as BikeIcon, ChevronLeft, Gauge, User, Hash, Wrench, Pencil, Sparkles, Camera, X, Save, Calendar, ShieldCheck } from "lucide-react";
import { fullBike } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BikeMakeModelYear } from "@/components/BikeMakeModelYear";
import { uploadPhoto } from "@/lib/photos";
import { generateBikeImage } from "@/lib/bike-image.functions";

export const Route = createFileRoute("/_authenticated/motorcycles/$bikeId")({
  component: BikeProfile,
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="card-surface p-6 space-y-3">
        <div className="font-semibold">Couldn't load bike</div>
        <div className="text-sm text-muted-foreground">{error.message}</div>
        <button
          className="text-sm text-primary"
          onClick={() => { reset(); router.invalidate(); }}
        >
          Try again
        </button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="card-surface p-6 text-sm text-muted-foreground">Bike not found.</div>
  ),
});

function BikeProfile() {
  const { bikeId } = Route.useParams();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const bike = useQuery({
    queryKey: ["bike", bikeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorcycles")
        .select("*, customers(id, first_name, last_name, phone, email)")
        .eq("id", bikeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!bike.data) return;
    const b: any = bike.data;
    setForm({
      make: b.make ?? "",
      model: b.model ?? "",
      year: b.year ?? "",
      rego: b.rego ?? "",
      mileage: b.mileage ?? "",
      vin: b.vin ?? "",
      rego_expiry: b.rego_expiry ?? "",
      wof_expiry: b.wof_expiry ?? "",
      ecu_info: b.ecu_info ?? "",
      modifications: b.modifications ?? "",
      notes: b.notes ?? "",
    });
    setPhotos(Array.isArray(b.photos) ? b.photos : []);
  }, [bike.data]);

  const jobs = useQuery({
    queryKey: ["bike-jobs", bikeId],
    queryFn: async () => (await supabase
      .from("jobs")
      .select("id, job_number, title, status, created_at")
      .eq("motorcycle_id", bikeId)
      .order("created_at", { ascending: false })
      .limit(20)).data ?? [],
  });

  if (bike.isLoading) return <div className="card-surface p-6 text-sm text-muted-foreground">Loading…</div>;
  const b: any = bike.data;
  if (!b) return <div className="card-surface p-6 text-sm text-muted-foreground">Bike not found.</div>;

  const hero = photos[0];

  async function autoGeneratePhoto() {
    const make = (form?.make || b.make || "").trim();
    const model = (form?.model || b.model || "").trim();
    if (!make || !model) return toast.error("Make and model required");
    setGenerating(true);
    try {
      const { b64_json } = await generateBikeImage({
        data: { make, model, year: form?.year ? String(form.year) : undefined },
      });
      const bin = atob(b64_json);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], `${make}-${model}.png`, { type: "image/png" });
      const path = await uploadPhoto(file, "bikes");
      const next = [...photos, path];
      setPhotos(next);
      if (!editing) {
        const { error } = await supabase.from("motorcycles").update({ photos: next }).eq("id", bikeId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["bike", bikeId] });
        qc.invalidateQueries({ queryKey: ["bikes-list"] });
      }
      toast.success("AI photo added");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to generate photo");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 4)) {
        uploaded.push(await uploadPhoto(file, "bikes"));
      }
      const next = [...photos, ...uploaded];
      setPhotos(next);
      if (!editing) {
        await supabase.from("motorcycles").update({ photos: next }).eq("id", bikeId);
        qc.invalidateQueries({ queryKey: ["bike", bikeId] });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function saveEdits() {
    if (!form) return;
    setSaving(true);
    try {
      const payload: any = {
        make: form.make.trim(),
        model: form.model.trim(),
        year: form.year ? parseInt(String(form.year)) : null,
        rego: form.rego || null,
        mileage: form.mileage ? parseInt(String(form.mileage)) : null,
        vin: form.vin || null,
        rego_expiry: form.rego_expiry || null,
        wof_expiry: form.wof_expiry || null,
        ecu_info: form.ecu_info || null,
        modifications: form.modifications || null,
        notes: form.notes || null,
        photos,
      };
      const { error } = await supabase.from("motorcycles").update(payload).eq("id", bikeId);
      if (error) throw error;
      toast.success("Bike updated");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["bike", bikeId] });
      qc.invalidateQueries({ queryKey: ["bikes-list"] });
    } catch (err: any) {
      toast.error(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link to="/motorcycles" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> All bikes
        </Link>
        {editing ? (
          <div className="flex items-center gap-2">
            <button onClick={() => { setEditing(false); setForm({ ...form, ...b, year: b.year ?? "", mileage: b.mileage ?? "" }); setPhotos(Array.isArray(b.photos) ? b.photos : []); }} className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground">Cancel</button>
            <Button onClick={saveEdits} disabled={saving} size="sm" className="gold-surface gap-1.5 font-bold">
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/50">
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5">
        {/* LEFT — Image + thumbnails */}
        <div className="space-y-3">
          <div className="card-surface overflow-hidden">
            {hero ? (
              <img src={hero} alt={fullBike(b)} className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-square grid place-items-center bg-muted">
                <BikeIcon className="h-10 w-10 text-primary" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={autoGeneratePhoto}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/20 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" /> {generating ? "Generating…" : "AI photo"}
            </button>
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/50 cursor-pointer">
              <Camera className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload"}
              <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
            </label>
          </div>

          {photos.length > 1 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.slice(1).map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt="" loading="lazy" className="rounded-lg border border-border object-cover aspect-square w-full" />
                  {editing && (
                    <button
                      onClick={() => setPhotos((arr) => arr.filter((x) => x !== p))}
                      className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-background/80 text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — All bike info */}
        <div className="space-y-5">
          <div className="card-surface p-4 space-y-2">
            {editing && form ? (
              <div className="space-y-2">
                <BikeMakeModelYear
                  value={{ make: form.make, model: form.model, year: String(form.year ?? "") }}
                  onChange={(v) => setForm({ ...form, make: v.make, model: v.model, year: v.year })}
                />
                <Input placeholder="Rego" value={form.rego} onChange={(e) => setForm({ ...form, rego: e.target.value.toUpperCase() })} />
              </div>
            ) : (
              <>
                <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{b.make}</div>
                <h1 className="font-display text-2xl font-bold">{b.model}</h1>
                <div className="text-sm text-muted-foreground">
                  {b.year ?? "—"}{b.rego ? ` · ${b.rego}` : ""}
                </div>
              </>
            )}
          </div>

          {editing && form ? (
            <div className="card-surface p-4 grid grid-cols-2 gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Mileage</div>
                <div className="relative">
                  <Input inputMode="numeric" value={form.mileage ? Number(String(form.mileage).replace(/\D/g, "")).toLocaleString() : ""} onChange={(e) => setForm({ ...form, mileage: e.target.value.replace(/\D/g, "") })} className="pr-12" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold pointer-events-none">km</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">VIN</div>
                <Input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Stat icon={<Gauge className="h-4 w-4" />} label="Mileage" value={b.mileage ? `${b.mileage.toLocaleString()} km` : "—"} />
              <Stat icon={<Hash className="h-4 w-4" />} label="VIN" value={b.vin || "—"} />
            </div>
          )}

          {b.customers && (
            <div className="card-surface p-4 space-y-1">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> Owner</div>
              <div className="font-semibold">{b.customers.first_name} {b.customers.last_name}</div>
              <div className="text-sm text-muted-foreground">{b.customers.phone || b.customers.email || ""}</div>
            </div>
          )}

          {editing && form ? (
            <div className="card-surface p-4 space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Modifications</div>
                <Textarea rows={2} value={form.modifications} onChange={(e) => setForm({ ...form, modifications: e.target.value })} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">ECU info</div>
                <Input value={form.ecu_info} onChange={(e) => setForm({ ...form, ecu_info: e.target.value })} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Notes</div>
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          ) : (
            (b.ecu_info || b.modifications || b.notes) && (
              <div className="card-surface p-4 space-y-3">
                {b.modifications && <Field label="Modifications" value={b.modifications} />}
                {b.ecu_info && <Field label="ECU" value={b.ecu_info} />}
                {b.notes && <Field label="Notes" value={b.notes} />}
              </div>
            )
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">
              <Wrench className="h-3 w-3" /> Service history
            </div>
            {(jobs.data ?? []).length === 0 && (
              <div className="card-surface p-4 text-sm text-muted-foreground">No jobs yet.</div>
            )}
            {(jobs.data ?? []).map((j: any) => (
              <Link
                key={j.id}
                to="/jobs/$jobId"
                params={{ jobId: j.id }}
                className="card-surface p-3 flex items-center justify-between hover:border-primary/40"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate text-sm">{j.title || j.job_number}</div>
                  <div className="text-xs text-muted-foreground">{j.job_number} · {new Date(j.created_at).toLocaleDateString()}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-muted">{j.status}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card-surface p-3">
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="font-semibold text-sm mt-1 truncate">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}
