/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Search, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ilikeValue } from "@/lib/postgrest-filter";
import { refreshContacts } from "@/lib/contacts-cache";

/** Change the customer of an existing book-in (and its job / bike owner). */
export function ChangeCustomerCard({ booking }: { booking: any }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [moveBike, setMoveBike] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nf, setNf] = useState({ first_name: "", last_name: "", phone: "", email: "" });

  const results = useQuery({
    queryKey: ["booking-change-customer", q],
    enabled: open && q.trim().length >= 2,
    queryFn: async () => {
      const p = ilikeValue(q);
      const { data, error } = await supabase
        .from("customers")
        .select("id, first_name, last_name, phone, email")
        .or(`first_name.ilike.${p},last_name.ilike.${p},phone.ilike.${p},email.ilike.${p}`)
        .order("first_name")
        .limit(15);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function apply(customerId: string, label: string) {
    if (customerId === booking.customer_id) return setOpen(false);
    if (!confirm(`Change this book-in's customer to ${label}?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ customer_id: customerId })
        .eq("id", booking.id);
      if (error) throw error;
      if (booking.job_id) {
        await supabase.from("jobs").update({ customer_id: customerId }).eq("id", booking.job_id);
      }
      if (moveBike && booking.motorcycle_id) {
        await supabase
          .from("motorcycles")
          .update({ customer_id: customerId })
          .eq("id", booking.motorcycle_id);
      }
      for (const k of [
        ["booking", booking.id],
        ["calendar-bookings"],
        ["day-bookings"],
        ["today-bookings"],
        ["job"],
        ["jobs"],
      ]) qc.invalidateQueries({ queryKey: k as any });
      await refreshContacts(qc);
      toast.success("Customer updated");
      setOpen(false);
      setQ("");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not change customer");
    } finally {
      setSaving(false);
    }
  }

  async function createAndApply() {
    if (!nf.first_name.trim() || !nf.phone.trim()) {
      return toast.error("First name and phone are required");
    }
    const { data, error } = await supabase
      .from("customers")
      .insert({
        first_name: nf.first_name.trim(),
        last_name: nf.last_name.trim() || null,
        phone: nf.phone.trim(),
        email: nf.email.trim() || null,
      } as any)
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setCreating(false);
    setNf({ first_name: "", last_name: "", phone: "", email: "" });
    await apply(data.id, `${nf.first_name} ${nf.last_name}`.trim());
  }

  const input =
    "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary/60 outline-none";

  return (
    <div className="card-surface p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <User className="h-3 w-3" /> Change customer
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Change"}
        </Button>
      </div>
      {open && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, phone or email…"
              className={input + " pl-8"}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={moveBike} onChange={(e) => setMoveBike(e.target.checked)} />
            Also move this motorcycle to the new customer
          </label>
          <div className="max-h-64 overflow-auto divide-y divide-border rounded-md border border-border">
            {(results.data ?? []).map((c: any) => {
              const label = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "No name";
              return (
                <button
                  key={c.id}
                  disabled={saving}
                  onClick={() => apply(c.id, label)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm"
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">
                    {[c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                  </div>
                </button>
              );
            })}
            {q.trim().length >= 2 && results.data?.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No customers found.</div>
            )}
          </div>
          {!creating ? (
            <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" /> New customer
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input className={input} placeholder="First name *" value={nf.first_name} onChange={(e) => setNf({ ...nf, first_name: e.target.value })} />
              <input className={input} placeholder="Last name" value={nf.last_name} onChange={(e) => setNf({ ...nf, last_name: e.target.value })} />
              <input className={input} placeholder="Phone *" value={nf.phone} onChange={(e) => setNf({ ...nf, phone: e.target.value })} />
              <input className={input} placeholder="Email" value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} />
              <div className="col-span-2 flex gap-2">
                <Button size="sm" onClick={createAndApply} disabled={saving}>Create & assign</Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
