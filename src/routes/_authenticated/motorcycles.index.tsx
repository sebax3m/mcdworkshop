/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bike as BikeIcon, Plus, Search, Camera, X, Sparkles, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { fullBike } from "@/lib/format";
import { uploadPhoto } from "@/lib/photos";
import { generateBikeImage } from "@/lib/bike-image.functions";
import { BikeMakeModelYear } from "@/components/BikeMakeModelYear";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/motorcycles/")({
  component: Bikes,
});

function Bikes() {
  const qc = useQueryClient();
  const { isAdmin } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [f, setF] = useState({
    customer_id: "",
    make: "",
    model: "",
    year: "",
    vin: "",
    rego: "",
    mileage: "",
    ecu_info: "",
    modifications: "",
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newCustOpen, setNewCustOpen] = useState(false);
  const [newCust, setNewCust] = useState({ first_name: "", last_name: "", phone: "", email: "" });
  const [savingCust, setSavingCust] = useState(false);

  const customers = useQuery({
    queryKey: ["customers-options"],
    queryFn: async () =>
      (await supabase.from("customers").select("id, first_name, last_name").order("first_name"))
        .data ?? [],
  });
  const bikes = useQuery({
    queryKey: ["bikes-list"],
    queryFn: async () =>
      (
        await supabase
          .from("motorcycles")
          .select("*, customers(first_name,last_name)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const filtered = (bikes.data ?? []).filter((b: any) => {
    const s =
      `${b.make} ${b.model} ${b.year ?? ""} ${b.rego ?? ""} ${b.customers?.first_name ?? ""} ${b.customers?.last_name ?? ""}`.toLowerCase();
    return s.includes(search.toLowerCase());
  });

  async function save() {
    if (!f.customer_id) return toast.error("Pick a customer");
    if (!f.make || !f.model) return toast.error("Make and model required");
    const payload: any = {
      ...f,
      year: f.year ? parseInt(f.year) : null,
      mileage: f.mileage ? parseInt(f.mileage) : null,
      photos,
    };
    const { error } = await supabase.from("motorcycles").insert(payload);
    if (error) return toast.error(error.message);
    setF({
      customer_id: "",
      make: "",
      model: "",
      year: "",
      vin: "",
      rego: "",
      mileage: "",
      ecu_info: "",
      modifications: "",
    });
    setPhotos([]);
    setOpen(false);
    toast.success("Bike added");
    qc.invalidateQueries({ queryKey: ["bikes-list"] });
  }

  async function deleteSelected() {
    if (!isAdmin) return toast.error("Admin only");
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} bike${ids.length > 1 ? "s" : ""}? This also removes linked bookings.`)) return;
    const { error } = await supabase.from("motorcycles").delete().in("id", ids);
    if (error) return toast.error(error.message);
    setSelected(new Set());
    toast.success(`${ids.length} deleted`);
    qc.invalidateQueries({ queryKey: ["bikes-list", "customers-bikes"] });
  }

  async function handleBikePhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 4)) {
        const path = await uploadPhoto(file, "bikes");
        uploaded.push(path);
      }
      setPhotos((p) => [...p, ...uploaded]);
      toast.success(`${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded`);
    } catch (err: any) {
      toast.error(err.message ?? "Photo upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function autoGenerateBikePhoto() {
    if (!f.make || !f.model) return toast.error("Enter make and model first");
    setGenerating(true);
    try {
      const { b64_json } = await generateBikeImage({
        data: { make: f.make, model: f.model, year: f.year || undefined },
      });
      const bin = atob(b64_json);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], `${f.make}-${f.model}.png`, { type: "image/png" });
      const path = await uploadPhoto(file, "bikes");
      setPhotos((p) => [...p, path]);
      toast.success("AI photo generated");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to generate photo");
    } finally {
      setGenerating(false);
    }
  }

  async function saveNewCustomer() {
    if (!newCust.first_name.trim()) return toast.error("First name required");
    setSavingCust(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          first_name: newCust.first_name.trim(),
          last_name: newCust.last_name.trim() || null,
          phone: newCust.phone.trim() || null,
          email: newCust.email.trim() || null,
        })
        .select("id, first_name, last_name")
        .single();
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["customers-options"] });
      setF((p) => ({ ...p, customer_id: data.id }));
      setNewCust({ first_name: "", last_name: "", phone: "", email: "" });
      setNewCustOpen(false);
      toast.success("Customer created");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create customer");
    } finally {
      setSavingCust(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Garage</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">
            {bikes.data?.length ?? 0} bikes
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && selectMode ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelected}
                disabled={selected.size === 0}
                className="gap-1.5 shrink-0"
              >
                <Trash2 className="h-4 w-4" /> Delete{selected.size > 0 ? ` (${selected.size})` : ""}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectMode(false);
                  setSelected(new Set());
                }}
                className="gap-1.5 shrink-0"
              >
                <X className="h-4 w-4" /> Cancel
              </Button>
            </>
          ) : (
            <>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectMode(true)}
                  className="shrink-0"
                >
                  Select
                </Button>
              )}
              <Button onClick={() => setOpen((o) => !o)} className="gold-surface gap-1.5 shrink-0">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search make, model, rego, owner"
          className="w-full rounded-xl bg-card border border-border pl-10 pr-3 py-3 text-sm"
        />
      </div>

      {open && (
        <div className="card-surface p-4 space-y-3">
          <div className="flex gap-2">
            <select
              value={f.customer_id}
              onChange={(e) => setF({ ...f, customer_id: e.target.value })}
              className="flex-1 rounded-md bg-input border border-border px-3 py-2 text-sm"
            >
              <option value="">Select customer…</option>
              {(customers.data ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNewCustOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 text-primary px-3 py-2 text-xs font-semibold hover:bg-primary/20"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          {newCustOpen && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                New customer
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="First name *"
                  value={newCust.first_name}
                  onChange={(e) => setNewCust({ ...newCust, first_name: e.target.value })}
                />
                <Input
                  placeholder="Last name (optional)"
                  value={newCust.last_name}
                  onChange={(e) => setNewCust({ ...newCust, last_name: e.target.value })}
                />
                <Input
                  placeholder="Phone"
                  inputMode="tel"
                  value={newCust.phone}
                  onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                />
                <Input
                  placeholder="Email (optional)"
                  inputMode="email"
                  value={newCust.email}
                  onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={saveNewCustomer}
                  disabled={savingCust}
                  className="gold-surface flex-1"
                >
                  {savingCust ? "Saving…" : "Save customer"}
                </Button>
                <Button variant="ghost" onClick={() => setNewCustOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <BikeMakeModelYear
            value={{ make: f.make, model: f.model, year: f.year }}
            onChange={(v) => setF({ ...f, make: v.make, model: v.model, year: v.year })}
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Rego"
              value={f.rego}
              onChange={(e) => setF({ ...f, rego: e.target.value.toUpperCase() })}
            />
            <div className="relative">
              <Input
                placeholder="Mileage (optional)"
                inputMode="numeric"
                value={f.mileage ? Number(f.mileage.replace(/\D/g, "")).toLocaleString() : ""}
                onChange={(e) => setF({ ...f, mileage: e.target.value.replace(/\D/g, "") })}
                className="pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold pointer-events-none">
                km
              </span>
            </div>
          </div>
          <Input
            placeholder="VIN"
            value={f.vin}
            onChange={(e) => setF({ ...f, vin: e.target.value })}
          />
          <Input
            placeholder="ECU info"
            value={f.ecu_info}
            onChange={(e) => setF({ ...f, ecu_info: e.target.value })}
          />
          <Textarea
            placeholder="Modifications"
            rows={2}
            value={f.modifications}
            onChange={(e) => setF({ ...f, modifications: e.target.value })}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Photos</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={autoGenerateBikePhoto}
                  disabled={generating || !f.make || !f.model}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-3.5 w-3.5" /> {generating ? "Generating…" : "AI generate"}
                </button>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary/50 cursor-pointer">
                  <Camera className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Add photo"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleBikePhotos(e.target.files)}
                  />
                </label>
              </div>
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {photos.map((p) => (
                  <div
                    key={p}
                    className="relative aspect-square rounded-lg overflow-hidden bg-muted"
                  >
                    <BikePhotoThumb path={p} />
                    <button
                      onClick={() => setPhotos((arr) => arr.filter((x) => x !== p))}
                      className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-background/80 text-foreground"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button onClick={save} className="gold-surface w-full">
            Save bike
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {isAdmin && selectMode && filtered.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              id="select-all-bikes"
              checked={selected.size === filtered.length}
              onCheckedChange={(checked) =>
                setSelected(checked ? new Set(filtered.map((b: any) => b.id)) : new Set())
              }
            />
            <label htmlFor="select-all-bikes" className="text-xs text-muted-foreground cursor-pointer">
              Select all
            </label>
          </div>
        )}
        {filtered.map((b: any) => {
          const checked = selected.has(b.id);
          const toggle = () =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(b.id)) next.delete(b.id);
              else next.add(b.id);
              return next;
            });
          const rowClass = `card-surface p-3 flex items-center gap-3 transition hover:border-primary/40 hover:bg-card/80 ${
            selectMode && checked ? "border-primary/60 bg-primary/5" : ""
          } ${selectMode ? "cursor-pointer" : "active:scale-[0.99]"}`;
          const inner = (
            <>
              {isAdmin && selectMode && (
                <Checkbox checked={checked} onCheckedChange={toggle} />
              )}
              {Array.isArray(b.photos) && b.photos[0] ? (
                <img
                  src={b.photos[0]}
                  alt={fullBike(b)}
                  loading="lazy"
                  className="h-14 w-20 rounded-lg object-cover border border-border"
                />
              ) : (
                <span className="grid h-14 w-20 place-items-center rounded-lg bg-muted">
                  <BikeIcon className="h-5 w-5 text-primary" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{fullBike(b)}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {b.customers ? `${b.customers.first_name} ${b.customers.last_name}` : "—"}
                  {b.rego ? ` · ${b.rego}` : ""}
                  {b.mileage ? ` · ${Number(b.mileage).toLocaleString()} km` : ""}
                </div>
              </div>
            </>
          );
          if (selectMode) {
            return (
              <div key={b.id} className={rowClass} onClick={toggle}>
                {inner}
              </div>
            );
          }
          return (
            <Link
              key={b.id}
              to="/motorcycles/$bikeId"
              params={{ bikeId: b.id }}
              className={rowClass}
            >
              {inner}
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="card-surface p-8 text-center text-sm text-muted-foreground">
            No bikes yet.
          </div>
        )}
      </div>
    </div>
  );
}

function BikePhotoThumb({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    import("@/lib/photos").then(({ getSignedUrl }) => getSignedUrl(path).then(setUrl));
  }, [path]);
  if (!url) return <div className="h-full w-full animate-pulse bg-muted" />;
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}
