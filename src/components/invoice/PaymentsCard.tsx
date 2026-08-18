/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Banknote, CreditCard, Landmark, Plus, Trash2 } from "lucide-react";

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "eftpos", label: "EFTPOS" },
  { value: "transfer", label: "Bank transfer" },
  { value: "card", label: "Credit card" },
  { value: "other", label: "Other" },
] as const;

export function methodLabel(m: string) {
  return PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m;
}

export function invoiceStatusMeta(status: string, paid: number, total: number) {
  const s = (status || "").toLowerCase();
  if (s === "paid" || (total > 0 && paid >= total))
    return { label: "Paid", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
  if (s === "part_paid" || (paid > 0 && paid < total))
    return { label: "Part paid", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
  if (s === "void" || s === "cancelled")
    return { label: "Void", className: "bg-muted text-muted-foreground border-border" };
  return { label: "Unpaid", className: "bg-red-500/15 text-red-400 border-red-500/30" };
}

const fmt = (n: number) => `$${Number(n || 0).toFixed(2)}`;

function MethodIcon({ m }: { m: string }) {
  if (m === "cash") return <Banknote className="h-4 w-4" />;
  if (m === "transfer") return <Landmark className="h-4 w-4" />;
  return <CreditCard className="h-4 w-4" />;
}

export function PaymentsCard({
  invoiceId,
  total,
  status,
  paidAmount,
}: {
  invoiceId: string;
  total: number;
  status: string;
  paidAmount: number;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const payments = useQuery({
    queryKey: ["invoice-payments", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_payments")
        .select("id, amount, method, paid_on, reference, note")
        .eq("invoice_id", invoiceId)
        .order("paid_on", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const paid = (payments.data ?? []).reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
  const outstanding = Math.max(0, Number(total || 0) - paid);
  const meta = invoiceStatusMeta(status, paid || Number(paidAmount || 0), Number(total || 0));

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("eftpos");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");

  function openForm() {
    setAmount(outstanding ? outstanding.toFixed(2) : "");
    setMethod("eftpos");
    setDate(new Date().toISOString().slice(0, 10));
    setReference("");
    setOpen(true);
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["invoice-payments", invoiceId] });
    await qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    await qc.invalidateQueries({ queryKey: ["invoices"] });
    await qc.invalidateQueries({ queryKey: ["analytics-invoices"] });
  }

  async function addPayment() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a payment amount");
      return;
    }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("invoice_payments").insert({
      invoice_id: invoiceId,
      amount: amt,
      method,
      paid_on: date,
      reference: reference || null,
      created_by: u.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Payment recorded");
    setOpen(false);
    refresh();
  }

  async function removePayment(id: string) {
    const { error } = await supabase.from("invoice_payments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Payment removed");
    refresh();
  }

  return (
    <div className="card-surface p-4 print:hidden space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-bold">Payments</h2>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${meta.className}`}
          >
            {meta.label}
          </span>
        </div>
        <Button size="sm" onClick={openForm} className="gap-2">
          <Plus className="h-4 w-4" /> Record payment
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Invoice total</div>
          <div className="font-display text-lg font-bold">{fmt(total)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Paid</div>
          <div className="font-display text-lg font-bold text-emerald-400">{fmt(paid)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding</div>
          <div
            className={`font-display text-lg font-bold ${outstanding > 0 ? "text-amber-400" : "text-muted-foreground"}`}
          >
            {fmt(outstanding)}
          </div>
        </div>
      </div>

      {open && (
        <div className="rounded-lg border border-border p-3 grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Method</Label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reference (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="sm:col-span-4 flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={addPayment} disabled={saving}>
              {saving ? "Saving…" : "Save payment"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(payments.data ?? []).map((p: any) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <span className="grid h-8 w-8 place-items-center rounded-md bg-muted text-primary">
              <MethodIcon m={p.method} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {fmt(p.amount)} · {methodLabel(p.method)}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {p.paid_on}
                {p.reference ? ` · ${p.reference}` : ""}
              </div>
            </div>
            <button
              onClick={() => removePayment(p.id)}
              className="text-muted-foreground hover:text-destructive"
              title="Remove payment"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {(payments.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            No payments recorded yet — this invoice is unpaid.
          </p>
        )}
      </div>
    </div>
  );
}
