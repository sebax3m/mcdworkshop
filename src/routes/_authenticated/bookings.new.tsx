import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Search, Bike as BikeIcon, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { fullBike, initials } from "@/lib/format";
import { uploadPhoto } from "@/lib/photos";

const searchSchema = z.object({ date: z.string().optional() });

export const Route = createFileRoute("/_authenticated/bookings/new")({
  validateSearch: zodValidator(searchSchema),
  component: NewBooking,
});

const SERVICE_TYPES = [
  "Basic Service",
  "Standard Service",
  "Full Service",
  "Dyno Tuning",
  "Diagnostic",
  "Tyre Change",
  "Brake Service",
  "Chain & Sprocket",
  "Suspension",
  "Other",
];

function NewBooking() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [bikeId, setBikeId] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<string>("Standard Service");
  const [scheduledDate, setScheduledDate] = useState<string>(search.date || today);
  const [dropTime, setDropTime] = useState<string>("09:00");
  const [estHours, setEstHours] = useState<string>("2");
  const [mileage, setMileage] = useState<string>("");
  const [wof, setWof] = useState<string>("");
  const [complaints, setComplaints] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [techId, setTechId] = useState<string | null>(null);
  const [arrivalPhotos, setArrivalPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search$, setSearch$] = useState("");

  const customers = useQuery({
    queryKey: ["bk-customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("first_name")).data ?? [],
  });
  const bikes = useQuery({
    queryKey: ["bk-bikes", customerId],
    enabled: !!customerId,
    queryFn: async () => (await supabase.from("motorcycles").select("*").eq("customer_id", customerId!)).data ?? [],
  });
  const techs = useQuery({
    queryKey: ["bk-techs"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id");
      const ids = [...new Set((roles ?? []).map((r: any) => r.user_id))];
      if (!ids.length) return [];
      return (await supabase.from("profiles").select("id, full_name").in("id", ids)).data ?? [];
    },
  });

  const customer = (customers.data as any[] | undefined)?.find((c) => c.id === customerId);
  const bike = (bikes.data as any[] | undefined)?.find((b) => b.id === bikeId);
  const filteredCustomers = useMemo(() => {
    const s = search$.toLowerCase();
    return (customers.data ?? []).filter((c: any) =>
      `${c.first_name} ${c.last_name} ${c.phone ?? ""}`.toLowerCase().includes(s),
    );
  }, [customers.data, search$]);

  async function handlePhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const f of Array.from(files).slice(0, 8)) {
        const path = await uploadPhoto(f, "arrival");
        uploaded.push(path);
      }
      setArrivalPhotos((p) => [...p, ...uploaded]);
      toast.success(`${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded`);
    } catch (err: any) {
      toast.error(err.message ?? "Photo upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!customer) return toast.error("Pick a customer");
    if (!bike) return toast.error("Pick a motorcycle");
    if (!scheduledDate) return toast.error("Pick a date");
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          customer_id: customer.id,
          motorcycle_id: bike.id,
          assigned_tech_id: techId,
          service_type: serviceType,
          scheduled_date: scheduledDate,
          drop_off_time: dropTime || null,
          estimated_hours: Number(estHours) || 1,
          mileage: mileage ? parseInt(mileage) : null,
          wof_expiry: wof || null,
          rego: bike.rego ?? null,
          vin: bike.vin ?? null,
          complaints,
          notes,
          arrival_photos: arrivalPhotos,
          status: "booked",
        })
        .select("id")
        .single();
      if (error) throw error;
      if (mileage) await supabase.from("motorcycles").update({ mileage: parseInt(mileage) }).eq("id", bike.id);
      toast.success("Booking created");
      nav({ to: "/calendar" });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create booking");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 max-w-3xl mx-auto"
    >
      <header className="flex items-center gap-3">
        <Link to="/calendar" className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:border-primary/50">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Reception</div>
          <h1 className="font-display text-2xl font-bold">New Booking</h1>
        </div>
      </header>

      {/* CUSTOMER */}
      <section className="card-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Customer</Label>
          {customer && (
            <button onClick={() => { setCustomerId(null); setBikeId(null); }} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
          )}
        </div>
        {customer ? (
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
            <span className="grid h-10 w-10 place-items-center rounded-full gold-surface font-semibold text-sm">
              {initials(`${customer.first_name} ${customer.last_name}`)}
            </span>
            <div className="min-w-0">
              <div className="font-semibold truncate">{customer.first_name} {customer.last_name}</div>
              <div className="text-xs text-muted-foreground truncate">{customer.phone || customer.email || "—"}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search$}
                onChange={(e) => setSearch$(e.target.value)}
                placeholder="Search customer"
                className="w-full rounded-xl bg-input border border-border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary/50"
              />
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1.5">
              {filteredCustomers.slice(0, 20).map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setCustomerId(c.id)}
                  className="w-full text-left flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 transition-colors"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-semibold">
                    {initials(`${c.first_name} ${c.last_name}`)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold truncate">{c.first_name} {c.last_name}</span>
                    <span className="block text-xs text-muted-foreground truncate">{c.phone || c.email}</span>
                  </span>
                </button>
              ))}
              {filteredCustomers.length === 0 && (
                <Link to="/customers" className="block text-center text-sm text-primary py-3">+ Add new customer</Link>
              )}
            </div>
          </>
        )}
      </section>

      {/* BIKE */}
      {customer && (
        <section className="card-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Motorcycle</Label>
            {bike && <button onClick={() => setBikeId(null)} className="text-xs text-muted-foreground hover:text-foreground">Change</button>}
          </div>
          {bike ? (
            <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-background"><BikeIcon className="h-5 w-5 text-primary" /></span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{fullBike(bike)}</div>
                <div className="text-xs text-muted-foreground truncate">{bike.rego ?? "no rego"}{bike.vin ? ` · VIN ${bike.vin.slice(-6)}` : ""}</div>
              </div>
            </div>
          ) : bikes.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading bikes…</div>
          ) : (bikes.data ?? []).length === 0 ? (
            <Link to="/motorcycles" className="block text-center text-sm text-primary py-3">+ Add motorcycle for this customer</Link>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {(bikes.data ?? []).map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => { setBikeId(b.id); if (b.mileage) setMileage(String(b.mileage)); if (b.wof_expiry) setWof(b.wof_expiry); }}
                  className="text-left rounded-xl border border-border p-3 hover:border-primary/50 transition-colors"
                >
                  <div className="font-semibold text-sm truncate">{fullBike(b)}</div>
                  <div className="text-xs text-muted-foreground truncate">{b.rego || "—"}</div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SERVICE */}
      {bike && (
        <>
          <section className="card-surface p-4 space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Service type</Label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPES.map((s) => (
                <button
                  key={s}
                  onClick={() => setServiceType(s)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${
                    serviceType === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          <section className="card-surface p-4 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Drop-off</Label>
              <Input type="time" value={dropTime} onChange={(e) => setDropTime(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Est. hours</Label>
              <Input type="number" min="0.25" step="0.25" value={estHours} onChange={(e) => setEstHours(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mileage (km)</Label>
              <Input type="number" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} className="mt-1.5" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">WOF expiry</Label>
              <Input type="date" value={wof} onChange={(e) => setWof(e.target.value)} className="mt-1.5" />
            </div>
          </section>

          <section className="card-surface p-4 space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assign technician</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                onClick={() => setTechId(null)}
                className={`rounded-xl border p-3 text-left text-sm ${techId === null ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <div className="font-semibold">Unassigned</div>
              </button>
              {(techs.data ?? []).map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setTechId(t.id)}
                  className={`rounded-xl border p-3 text-left flex items-center gap-2 ${techId === t.id ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[10px] font-semibold">{initials(t.full_name || "?")}</span>
                  <span className="text-sm font-semibold truncate">{t.full_name || "Unnamed"}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card-surface p-4 space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Customer complaint</Label>
            <Textarea value={complaints} onChange={(e) => setComplaints(e.target.value)} placeholder="e.g. Engine miss above 6k rpm" rows={2} />
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Internal notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Drop-off arrangement, customer prefs…" rows={2} />
          </section>

          <section className="card-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Arrival & damage photos</Label>
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50 cursor-pointer">
                <Camera className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Add"}
                <input type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
              </label>
            </div>
            {arrivalPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {arrivalPhotos.map((p) => (
                  <div key={p} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    <PhotoThumb path={p} />
                    <button
                      onClick={() => setArrivalPhotos((arr) => arr.filter((x) => x !== p))}
                      className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-background/80 text-foreground"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <Button onClick={save} disabled={saving} className="w-full h-14 gold-surface text-base font-bold">
            {saving ? "Saving…" : "Create Booking"}
          </Button>
        </>
      )}
    </motion.div>
  );
}

function PhotoThumb({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  useMemo(() => {
    import("@/lib/photos").then(({ getSignedUrl }) => getSignedUrl(path).then(setUrl));
  }, [path]);
  if (!url) return <div className="h-full w-full animate-pulse bg-muted" />;
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}