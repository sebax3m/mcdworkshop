import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, ChevronRight, Plus, Search, Bike as BikeIcon } from "lucide-react";
import { toast } from "sonner";
import { fullBike, initials } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/jobs/new")({
  component: NewJob,
});

type Step = "customer" | "bike" | "template" | "tech";

function NewJob() {
  const nav = useNavigate();
  const { isAdmin } = useCurrentUser();
  const [step, setStep] = useState<Step>("customer");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [bikeId, setBikeId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [techId, setTechId] = useState<string | null>(null);
  const [complaint, setComplaint] = useState("");
  const [creating, setCreating] = useState(false);

  const customers = useQuery({
    queryKey: ["customers-all"],
    queryFn: async () => (await supabase.from("customers").select("*").order("first_name")).data ?? [],
  });
  const bikes = useQuery({
    queryKey: ["bikes-for", customerId],
    enabled: !!customerId,
    queryFn: async () => (await supabase.from("motorcycles").select("*").eq("customer_id", customerId!)).data ?? [],
  });
  const templates = useQuery({
    queryKey: ["templates"],
    queryFn: async () => (await supabase.from("service_templates").select("*").eq("is_active", true).order("sort_order")).data ?? [],
  });
  const techs = useQuery({
    queryKey: ["techs"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id");
      const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return data ?? [];
    },
  });

  const customer = customers.data?.find((c: any) => c.id === customerId);
  const bike = bikes.data?.find((b: any) => b.id === bikeId);
  const template = templates.data?.find((t: any) => t.id === templateId);
  const tech = techs.data?.find((t: any) => t.id === techId);

  if (!isAdmin) {
    return (
      <div className="card-surface p-8 text-center">
        <p className="text-muted-foreground">Only admins can create jobs.</p>
        <Link to="/jobs" className="text-primary text-sm font-semibold mt-3 inline-block">Back to jobs</Link>
      </div>
    );
  }

  async function createJob() {
    if (!customer || !bike || !template) return;
    setCreating(true);
    try {
      const { data: job, error } = await supabase
        .from("jobs")
        .insert({
          customer_id: customer.id,
          motorcycle_id: bike.id,
          template_id: template.id,
          technician_id: techId,
          title: template.name,
          description: template.description,
          complaint,
          estimated_hours: template.estimated_hours,
          status: techId ? "assigned" : "new",
        })
        .select("id")
        .single();
      if (error) throw error;

      const tasks = (template.tasks as { label: string }[]).map((t, i) => ({
        job_id: job.id,
        label: t.label,
        sort_order: i,
      }));
      if (tasks.length) await supabase.from("job_tasks").insert(tasks);

      toast.success(`Job #created`);
      nav({ to: "/jobs/$jobId", params: { jobId: job.id } });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to create job");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <header className="flex items-center gap-3">
        <Link to="/jobs" className="grid h-9 w-9 place-items-center rounded-lg border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Quick Create</div>
          <h1 className="font-display text-2xl font-bold">New Job</h1>
        </div>
      </header>

      {/* Progress chips */}
      <div className="flex items-center gap-1.5 text-xs">
        <Chip active={step === "customer"} done={!!customer} onClick={() => setStep("customer")} label="Customer" value={customer ? `${customer.first_name} ${customer.last_name}` : undefined} />
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <Chip active={step === "bike"} done={!!bike} onClick={() => customer && setStep("bike")} label="Bike" value={bike ? fullBike(bike) : undefined} />
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <Chip active={step === "template"} done={!!template} onClick={() => bike && setStep("template")} label="Service" value={template?.name} />
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <Chip active={step === "tech"} done={!!tech} onClick={() => template && setStep("tech")} label="Tech" value={tech?.full_name ?? (template ? "Skip" : undefined)} />
      </div>

      {step === "customer" && (
        <CustomerPicker
          customers={customers.data ?? []}
          loading={customers.isLoading}
          onPick={(c) => { setCustomerId(c.id); setBikeId(null); setStep("bike"); }}
          onRefetch={customers.refetch}
        />
      )}
      {step === "bike" && customer && (
        <BikePicker
          customer={customer}
          bikes={bikes.data ?? []}
          loading={bikes.isLoading}
          onPick={(b) => { setBikeId(b.id); setStep("template"); }}
          onRefetch={bikes.refetch}
          onBack={() => setStep("customer")}
        />
      )}
      {step === "template" && (
        <TemplatePicker
          templates={templates.data ?? []}
          selectedId={templateId}
          onPick={(t) => { setTemplateId(t.id); setStep("tech"); }}
          onBack={() => setStep("bike")}
        />
      )}
      {step === "tech" && (
        <div className="space-y-4">
          <div className="card-surface p-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assign technician (optional)</Label>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => setTechId(null)}
                className={`rounded-xl border p-3 text-left transition-colors ${techId === null ? "border-primary bg-primary/10" : "border-border"}`}
              >
                <div className="text-sm font-semibold">Unassigned</div>
                <div className="text-xs text-muted-foreground">Leave on board</div>
              </button>
              {(techs.data ?? []).map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setTechId(t.id)}
                  className={`rounded-xl border p-3 text-left transition-colors flex items-center gap-3 ${techId === t.id ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-semibold">
                    {initials(t.full_name || "?")}
                  </span>
                  <span className="text-sm font-semibold truncate">{t.full_name || "Unnamed"}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="card-surface p-4">
            <Label htmlFor="complaint" className="text-xs uppercase tracking-wider text-muted-foreground">Customer complaint / notes</Label>
            <Textarea
              id="complaint"
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="e.g. Front brakes spongy under heavy use"
              className="mt-2"
              rows={3}
            />
          </div>
          <Button onClick={createJob} disabled={creating} className="w-full h-14 gold-surface text-base font-bold">
            {creating ? "Creating…" : "Create Job"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Chip({ active, done, onClick, label, value }: { active: boolean; done: boolean; onClick: () => void; label: string; value?: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
        active ? "border-primary bg-primary/10 text-primary" : done ? "border-status-ready/40 bg-status-ready/10 text-status-ready" : "border-border text-muted-foreground"
      }`}
    >
      {done && !active ? <Check className="inline h-3 w-3 mr-1" /> : null}
      {value ? <span className="max-w-[110px] truncate inline-block align-middle">{value}</span> : label}
    </button>
  );
}

function CustomerPicker({ customers, loading, onPick, onRefetch }: any) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState(""); const [last, setLast] = useState("");
  const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (customers ?? []).filter((c: any) => `${c.first_name} ${c.last_name} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(s));
  }, [customers, search]);

  async function add() {
    if (!first.trim()) return toast.error("First name required");
    const { data, error } = await supabase.from("customers").insert({ first_name: first, last_name: last, phone, email }).select("*").single();
    if (error) return toast.error(error.message);
    toast.success("Customer added");
    setOpen(false); setFirst(""); setLast(""); setPhone(""); setEmail("");
    await onRefetch();
    onPick(data);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers" className="w-full rounded-xl bg-card border border-border pl-10 pr-3 py-3 text-sm" />
      </div>
      <button onClick={() => setOpen((o) => !o)} className="w-full card-surface p-4 flex items-center gap-3 hover:border-primary/40">
        <span className="grid h-9 w-9 place-items-center rounded-lg gold-surface"><Plus className="h-4 w-4" /></span>
        <span className="font-semibold">New customer</span>
      </button>
      {open && (
        <div className="card-surface p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="First name *" value={first} onChange={(e) => setFirst(e.target.value)} />
            <Input placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={add} className="w-full gold-surface">Add & continue</Button>
        </div>
      )}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c: any) => (
            <button key={c.id} onClick={() => onPick(c)} className="w-full card-surface p-3 flex items-center gap-3 hover:border-primary/40 text-left">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-muted font-semibold text-sm">{initials(`${c.first_name} ${c.last_name}`)}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold truncate">{c.first_name} {c.last_name}</span>
                <span className="block text-xs text-muted-foreground truncate">{c.phone || c.email || "—"}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BikePicker({ customer, bikes, loading, onPick, onRefetch, onBack }: any) {
  const [open, setOpen] = useState(false);
  const [make, setMake] = useState(""); const [model, setModel] = useState(""); const [year, setYear] = useState(""); const [rego, setRego] = useState("");

  async function add() {
    if (!make || !model) return toast.error("Make and model required");
    const { data, error } = await supabase.from("motorcycles").insert({
      customer_id: customer.id,
      make, model, year: year ? parseInt(year) : null, rego,
    }).select("*").single();
    if (error) return toast.error(error.message);
    toast.success("Bike added");
    setOpen(false); setMake(""); setModel(""); setYear(""); setRego("");
    await onRefetch();
    onPick(data);
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">Bikes for <span className="text-foreground font-semibold">{customer.first_name} {customer.last_name}</span></div>
      <button onClick={() => setOpen((o) => !o)} className="w-full card-surface p-4 flex items-center gap-3 hover:border-primary/40">
        <span className="grid h-9 w-9 place-items-center rounded-lg gold-surface"><Plus className="h-4 w-4" /></span>
        <span className="font-semibold">New motorcycle</span>
      </button>
      {open && (
        <div className="card-surface p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Make *" value={make} onChange={(e) => setMake(e.target.value)} />
            <Input placeholder="Model *" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
            <Input placeholder="Rego" value={rego} onChange={(e) => setRego(e.target.value.toUpperCase())} />
          </div>
          <Button onClick={add} className="w-full gold-surface">Add & continue</Button>
        </div>
      )}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : bikes.length === 0 && !open ? (
        <div className="card-surface p-6 text-center text-sm text-muted-foreground">No bikes yet — add one above.</div>
      ) : (
        <div className="space-y-2">
          {bikes.map((b: any) => (
            <button key={b.id} onClick={() => onPick(b)} className="w-full card-surface p-3 flex items-center gap-3 hover:border-primary/40 text-left">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted"><BikeIcon className="h-5 w-5 text-primary" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold truncate">{fullBike(b)}</span>
                <span className="block text-xs text-muted-foreground truncate">{b.rego || "—"}{b.mileage ? ` · ${b.mileage} km` : ""}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
      <button onClick={onBack} className="text-xs text-muted-foreground">← Change customer</button>
    </div>
  );
}

function TemplatePicker({ templates, selectedId, onPick, onBack }: any) {
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-2">
        {templates.map((t: any) => (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            className={`card-surface p-4 text-left hover:border-primary/40 transition-colors ${selectedId === t.id ? "border-primary" : ""}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-primary">{t.estimated_hours}h est.</div>
                <div className="font-display text-lg font-bold mt-0.5">{t.name}</div>
              </div>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-xs font-semibold">
                {Array.isArray(t.tasks) ? t.tasks.length : 0}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{t.description}</p>
          </button>
        ))}
      </div>
      <button onClick={onBack} className="text-xs text-muted-foreground">← Change bike</button>
    </div>
  );
}