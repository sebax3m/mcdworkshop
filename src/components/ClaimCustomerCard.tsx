/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, Search, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { displayCustomerName } from "@/lib/display";

type Customer = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
};

export function ClaimCustomerCard({
  customer,
  claimId,
}: {
  customer: Customer | null | undefined;
  claimId: string;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"idle" | "search" | "new">("idle");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "" });

  async function refreshClaim() {
    await qc.invalidateQueries({ queryKey: ["insurance-claim", claimId] });
    await qc.invalidateQueries({ queryKey: ["insurance-claims"] });
  }

  async function linkCustomer(customerId: string) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("insurance_claims")
        .update({ customer_id: customerId } as any)
        .eq("id", claimId);
      if (error) throw error;
      await refreshClaim();
      setMode("idle");
      toast.success("Customer linked to claim");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to link customer");
    } finally {
      setSaving(false);
    }
  }

  async function runSearch(value: string) {
    setSearch(value);
    const term = value.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const pattern = `%${term}%`;
    const { data, error } = await supabase
      .from("customers")
      .select("id,first_name,last_name,phone,email")
      .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
      .eq("is_archived", false)
      .order("first_name")
      .limit(20);
    if (error) {
      toast.error(error.message);
      return;
    }
    setResults((data as Customer[]) ?? []);
  }

  async function createCustomer() {
    if (!form.first_name.trim()) {
      toast.error("First name is required");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          phone: form.phone.trim(),
          email: form.email.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: linkError } = await supabase
        .from("insurance_claims")
        .update({ customer_id: data.id } as any)
        .eq("id", claimId);
      if (linkError) throw linkError;
      setForm({ first_name: "", last_name: "", phone: "", email: "" });
      await qc.invalidateQueries({ queryKey: ["ins-customers"] });
      await qc.invalidateQueries({ queryKey: ["customers"] });
      await refreshClaim();
      setMode("idle");
      toast.success("Customer created and linked");
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to create customer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card-surface p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
          Customer
        </div>
        {mode === "idle" && (
          <div className="flex gap-2 print:hidden">
            <button
              type="button"
              onClick={() => setMode("search")}
              className="inline-flex items-center gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <Search className="h-3 w-3" /> {customer ? "Change" : "Link"}
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className="inline-flex items-center gap-1 text-[0.625rem] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> New
            </button>
          </div>
        )}
      </div>

      {mode === "idle" ? (
        customer ? (
          <>
            <div className="flex items-center gap-1.5 font-bold">
              <UserRound className="h-4 w-4" /> {displayCustomerName(customer, "—")}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact details"}
            </div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">No customer linked</div>
        )
      ) : mode === "search" ? (
        <div className="space-y-2 print:hidden">
          <Input
            autoFocus
            value={search}
            onChange={(event) => void runSearch(event.target.value)}
            placeholder="Search name, phone or email…"
            className="h-8 text-xs"
          />
          <div className="max-h-52 overflow-auto rounded-md border border-border divide-y divide-border">
            {search.trim().length < 2 ? (
              <div className="p-3 text-xs text-muted-foreground">Type at least 2 characters.</div>
            ) : results.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No customers found.</div>
            ) : (
              results.map((result) => (
                <button
                  type="button"
                  key={result.id}
                  disabled={saving}
                  onClick={() => void linkCustomer(result.id)}
                  className="w-full px-3 py-2 text-left hover:bg-muted/60"
                >
                  <div className="text-xs font-semibold">{displayCustomerName(result, "—")}</div>
                  <div className="text-[0.65rem] text-muted-foreground">
                    {[result.phone, result.email].filter(Boolean).join(" · ") || "No contact details"}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setMode("new")}>
              <Plus className="h-3.5 w-3.5" /> New customer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2 print:hidden">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[0.625rem] uppercase text-muted-foreground">First name *</Label>
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[0.625rem] uppercase text-muted-foreground">Last name</Label>
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[0.625rem] uppercase text-muted-foreground">Phone *</Label>
              <Input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[0.625rem] uppercase text-muted-foreground">Email</Label>
              <Input inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => void createCustomer()} disabled={saving}>
              <Link2 className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Create & link"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={saving}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}