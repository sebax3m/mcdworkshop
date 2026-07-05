import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Bike as BikeIcon, Wrench, StickyNote, CalendarClock, User as UserIcon, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/loan-bikes/$bikeId")({
  component: LoanBikeDetail,
});

function LoanBikeDetail() {
  const { bikeId } = Route.useParams();
  const nav = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Bike
  const bikeQ = useQuery({
    queryKey: ["loan-bike", bikeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_bikes").select("*").eq("id", bikeId).single();
      if (error) throw error;
      return data as any;
    },
  });
  const bike = bikeQ.data;

  // Assignments history
  const assignmentsQ = useQuery({
    queryKey: ["loan-bike-assignments", bikeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, scheduled_date, loan_bike_expected_return, loan_bike_returned_at, loan_bike_start_km, loan_bike_end_km, job_id, status, customers(first_name,last_name,phone), motorcycles(make,model,year)")
        .eq("loan_bike_id", bikeId)
        .order("scheduled_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Service logs
  const logsQ = useQuery({
    queryKey: ["loan-bike-logs", bikeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_bike_service_logs")
        .select("*").eq("loan_bike_id", bikeId).order("service_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Notes
  const notesQ = useQuery({
    queryKey: ["loan-bike-notes", bikeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("loan_bike_notes")
        .select("*").eq("loan_bike_id", bikeId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Edit bike form state (initialised when bike loads)
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [rego, setRego] = useState("");
  const [currentKm, setCurrentKm] = useState("");
  const [interval, setInterval] = useState("");
  const [lastServiceKm, setLastServiceKm] = useState("");
  const [lastServiceDate, setLastServiceDate] = useState("");

  function openEdit() {
    setName(bike.name ?? "");
    setMake(bike.make ?? "");
    setModel(bike.model ?? "");
    setColor(bike.color ?? "");
    setRego(bike.rego ?? "");
    setCurrentKm(String(bike.current_km ?? 0));
    setInterval(String(bike.service_interval_km ?? 5000));
    setLastServiceKm(bike.last_service_km != null ? String(bike.last_service_km) : "");
    setLastServiceDate(bike.last_service_date ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    try {
      const { error } = await supabase.from("loan_bikes").update({
        name, make: make || null, model: model || null, color: color || null, rego: rego || null,
        current_km: parseInt(currentKm) || 0,
        service_interval_km: parseInt(interval) || 5000,
        last_service_km: lastServiceKm ? parseInt(lastServiceKm) : null,
        last_service_date: lastServiceDate || null,
      }).eq("id", bikeId);
      if (error) throw error;
      toast.success("Saved");
      setEditing(false);
      bikeQ.refetch();
    } catch (e: any) { toast.error(e.message); }
  }

  // Add service log
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logKm, setLogKm] = useState("");
  const [logDesc, setLogDesc] = useState("");
  const [logCost, setLogCost] = useState("");
  async function addLog() {
    if (!logDesc.trim()) return toast.error("Description required");
    try {
      const km = logKm ? parseInt(logKm) : null;
      const { error } = await supabase.from("loan_bike_service_logs").insert({
        loan_bike_id: bikeId,
        service_date: logDate,
        km,
        description: logDesc.trim(),
        cost: logCost ? Number(logCost) : null,
      });
      if (error) throw error;
      // Also bump last_service_km + date on bike
      const update: any = { last_service_date: logDate };
      if (km != null) {
        update.last_service_km = km;
        if (km > (bike.current_km ?? 0)) update.current_km = km;
      }
      await supabase.from("loan_bikes").update(update).eq("id", bikeId);
      toast.success("Service logged");
      setLogKm(""); setLogDesc(""); setLogCost("");
      logsQ.refetch(); bikeQ.refetch();
    } catch (e: any) { toast.error(e.message); }
  }

  // Add note
  const [note, setNote] = useState("");
  async function addNote() {
    if (!note.trim()) return;
    try {
      const { error } = await supabase.from("loan_bike_notes").insert({ loan_bike_id: bikeId, note: note.trim() });
      if (error) throw error;
      setNote("");
      notesQ.refetch();
    } catch (e: any) { toast.error(e.message); }
  }

  async function deleteNote(id: string) {
    await supabase.from("loan_bike_notes").delete().eq("id", id);
    notesQ.refetch();
  }

  async function deleteBike() {
    try {
      const { error } = await supabase.from("loan_bikes").delete().eq("id", bikeId);
      if (error) throw error;
      toast.success("Deleted");
      nav({ to: "/loan-bikes" });
    } catch (e: any) { toast.error(e.message); }
  }

  if (bikeQ.isLoading) return <div className="card-surface p-8 text-center text-muted-foreground">Loading…</div>;
  if (!bike) return <div className="card-surface p-8 text-center text-muted-foreground">Not found.</div>;

  const nextServiceKm = (bike.last_service_km ?? 0) + (bike.service_interval_km || 5000);
  const kmToService = nextServiceKm - bike.current_km;
  const active = (assignmentsQ.data ?? []).find((a) => !a.loan_bike_returned_at);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <header className="flex items-center gap-3">
        <Link to="/loan-bikes" className="grid h-9 w-9 place-items-center rounded-lg border border-border">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Loan bike</div>
          <h1 className="font-display text-2xl font-bold truncate">{bike.name}</h1>
        </div>
        <button onClick={openEdit} className="text-xs font-semibold rounded-lg border border-border px-3 h-9">Edit</button>
        <button onClick={() => setConfirmDelete(true)} className="grid h-9 w-9 place-items-center rounded-lg border border-destructive/40 text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </header>

      {/* Status */}
      <section className="card-surface p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/10 text-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            <BikeIcon className="h-3 w-3" />
            {bike.make} {bike.model} {bike.color ? `· ${bike.color}` : ""}
          </span>
          {bike.rego && <span className="text-xs text-muted-foreground">Rego: {bike.rego}</span>}
          {active ? (
            <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Currently out</span>
          ) : (
            <span className="rounded-full bg-emerald-500/15 text-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">Available</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Current km</div>
            <div className="font-display text-xl font-bold">{bike.current_km.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Next service</div>
            <div className="font-display text-xl font-bold">{nextServiceKm.toLocaleString()}</div>
            <div className={`text-[10px] ${kmToService <= 500 ? "text-amber-400" : "text-muted-foreground"}`}>
              {kmToService > 0 ? `${kmToService.toLocaleString()} km to go` : `${Math.abs(kmToService).toLocaleString()} km overdue`}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Last service</div>
            <div className="text-sm font-semibold">{bike.last_service_date ? format(new Date(bike.last_service_date + "T00:00:00"), "d MMM yyyy") : "—"}</div>
            <div className="text-[10px] text-muted-foreground">{bike.last_service_km != null ? `@ ${bike.last_service_km.toLocaleString()} km` : ""}</div>
          </div>
        </div>
        {active && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm">
            <div className="text-[10px] uppercase tracking-widest text-amber-400 mb-1">Currently assigned</div>
            <div className="flex items-center gap-2 flex-wrap">
              <UserIcon className="h-3.5 w-3.5" />
              <span className="font-semibold">{active.customers ? `${active.customers.first_name} ${active.customers.last_name}` : "—"}</span>
              <span className="text-xs text-muted-foreground">· Given {format(new Date(active.scheduled_date + "T00:00:00"), "d MMM")}</span>
              {active.loan_bike_expected_return && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                  <CalendarClock className="h-3 w-3" /> Return by {format(new Date(active.loan_bike_expected_return + "T00:00:00"), "d MMM")}
                </span>
              )}
              {active.job_id && (
                <Link to="/jobs/$jobId" params={{ jobId: active.job_id }} className="text-xs font-semibold text-primary hover:underline">
                  Open Job Card
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Service log */}
      <section className="card-surface p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Service log</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
          <Input type="number" inputMode="numeric" placeholder="km" value={logKm} onChange={(e) => setLogKm(e.target.value)} />
          <Input placeholder="Description (oil change…)" value={logDesc} onChange={(e) => setLogDesc(e.target.value)} className="col-span-2 sm:col-span-1" />
          <Input type="number" inputMode="decimal" placeholder="Cost $" value={logCost} onChange={(e) => setLogCost(e.target.value)} />
        </div>
        <Button onClick={addLog} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-1" /> Log service</Button>
        <ul className="space-y-2">
          {(logsQ.data ?? []).map((l) => (
            <li key={l.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{l.description}</span>
                <span className="text-xs text-muted-foreground">{format(new Date(l.service_date + "T00:00:00"), "d MMM yyyy")}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {l.km != null && <>@ {Number(l.km).toLocaleString()} km </>}
                {l.cost != null && <>· ${Number(l.cost).toFixed(2)}</>}
              </div>
            </li>
          ))}
          {(logsQ.data ?? []).length === 0 && (
            <li className="text-xs text-muted-foreground">No services logged yet.</li>
          )}
        </ul>
      </section>

      {/* Notes */}
      <section className="card-surface p-4 space-y-3">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Notes</h2>
        </div>
        <div className="flex gap-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember about this bike…" rows={2} />
          <Button onClick={addNote}>Add</Button>
        </div>
        <ul className="space-y-2">
          {(notesQ.data ?? []).map((n) => (
            <li key={n.id} className="rounded-lg border border-border p-3 text-sm flex items-start gap-2">
              <span className="flex-1 whitespace-pre-wrap">{n.note}</span>
              <button onClick={() => deleteNote(n.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
          {(notesQ.data ?? []).length === 0 && (
            <li className="text-xs text-muted-foreground">No notes yet.</li>
          )}
        </ul>
      </section>

      {/* Assignment history */}
      <section className="card-surface p-4 space-y-3">
        <h2 className="font-semibold">Assignment history</h2>
        <ul className="space-y-2">
          {(assignmentsQ.data ?? []).map((a) => (
            <li key={a.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-semibold">
                  {a.customers ? `${a.customers.first_name} ${a.customers.last_name}` : "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(a.scheduled_date + "T00:00:00"), "d MMM yyyy")}
                  {a.loan_bike_returned_at ? ` → returned ${format(new Date(a.loan_bike_returned_at), "d MMM")}` :
                    a.loan_bike_expected_return ? ` · exp. return ${format(new Date(a.loan_bike_expected_return + "T00:00:00"), "d MMM")}` : ""}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {a.loan_bike_start_km != null && <>Start: {Number(a.loan_bike_start_km).toLocaleString()} km </>}
                {a.loan_bike_end_km != null && <>· End: {Number(a.loan_bike_end_km).toLocaleString()} km</>}
                {a.job_id && (
                  <Link to="/jobs/$jobId" params={{ jobId: a.job_id }} className="ml-2 text-primary hover:underline">Job Card</Link>
                )}
                {!a.loan_bike_returned_at && (
                  <button
                    onClick={async () => {
                      const endKm = prompt("End km reading?");
                      if (!endKm) return;
                      const km = parseInt(endKm);
                      if (isNaN(km)) return toast.error("Invalid");
                      await supabase.from("bookings").update({
                        loan_bike_returned_at: new Date().toISOString(),
                        loan_bike_end_km: km,
                      }).eq("id", a.id);
                      if (km > (bike.current_km ?? 0)) {
                        await supabase.from("loan_bikes").update({ current_km: km }).eq("id", bikeId);
                      }
                      toast.success("Marked returned");
                      assignmentsQ.refetch(); bikeQ.refetch();
                    }}
                    className="ml-2 text-emerald-500 hover:underline"
                  >
                    Mark returned
                  </button>
                )}
              </div>
            </li>
          ))}
          {(assignmentsQ.data ?? []).length === 0 && (
            <li className="text-xs text-muted-foreground">No assignments yet.</li>
          )}
        </ul>
      </section>

      {/* Edit dialog */}
      <AlertDialog open={editing} onOpenChange={setEditing}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit loan bike</AlertDialogTitle>
            <AlertDialogDescription>Update this bike's details, current kilometres and service schedule.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Make</Label><Input value={make} onChange={(e) => setMake(e.target.value)} /></div>
              <div><Label>Model</Label><Input value={model} onChange={(e) => setModel(e.target.value)} /></div>
              <div><Label>Colour</Label><Input value={color} onChange={(e) => setColor(e.target.value)} /></div>
              <div><Label>Rego</Label><Input value={rego} onChange={(e) => setRego(e.target.value)} /></div>
              <div><Label>Current km</Label><Input type="number" value={currentKm} onChange={(e) => setCurrentKm(e.target.value)} /></div>
              <div><Label>Service interval (km)</Label><Input type="number" value={interval} onChange={(e) => setInterval(e.target.value)} /></div>
              <div><Label>Last service km</Label><Input type="number" value={lastServiceKm} onChange={(e) => setLastServiceKm(e.target.value)} /></div>
              <div><Label>Last service date</Label><Input type="date" value={lastServiceDate} onChange={(e) => setLastServiceDate(e.target.value)} /></div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveEdit}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this loan bike?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the bike and all of its service logs and notes. Booking history stays intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteBike} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
