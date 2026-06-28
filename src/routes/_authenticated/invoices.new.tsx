import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Search, GripVertical, BookOpen, X, Mail, Printer } from "lucide-react";
import { toast } from "sonner";
import { fullBike } from "@/lib/format";
import logoAsset from "@/assets/motorcycle-doctors-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/invoices/new")({
  component: NewInvoice,
});

const GST_RATE = 0.15;

type Line = {
  item_code: string;
  item_name: string;
  description: string;
  quantity: number;
  unit: number;
  discount_pct: number;
};

function emptyLine(): Line {
  return { item_code: "", item_name: "", description: "", quantity: 1, unit: 0, discount_pct: 0 };
}

function NewInvoice() {
  const nav = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [bikeId, setBikeId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [ncFirst, setNcFirst] = useState("");
  const [ncLast, setNcLast] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncEmail, setNcEmail] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const [showNewBike, setShowNewBike] = useState(false);
  const [nbMake, setNbMake] = useState("");
  const [nbModel, setNbModel] = useState("");
  const [nbYear, setNbYear] = useState("");
  const [nbRego, setNbRego] = useState("");
  const [nbColor, setNbColor] = useState("");
  const [creatingBike, setCreatingBike] = useState(false);

  const [invoiceDate, setInvoiceDate] = useState<string>(today);
  const [notes, setNotes] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [libraryOpenForIdx, setLibraryOpenForIdx] = useState<number | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");

  const customers = useQuery({
    queryKey: ["new-inv-customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("first_name")).data ?? [],
  });
  const bikes = useQuery({
    queryKey: ["new-inv-bikes", customerId],
    enabled: !!customerId,
    queryFn: async () => (await supabase.from("motorcycles").select("*").eq("customer_id", customerId!)).data ?? [],
  });
  const library = useQuery({
    queryKey: ["inv-library"],
    queryFn: async () => (await supabase.from("inventory_items").select("*").order("name")).data ?? [],
  });

  const year = new Date().getFullYear();
  const nextInvoiceNumber = useQuery({
    queryKey: ["next-invoice-number", year],
    queryFn: async () => {
      const { data: last } = await supabase
        .from("invoices")
        .select("invoice_number")
        .like("invoice_number", `MCD-${year}-%`)
        .order("invoice_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastSeq = last?.invoice_number ? Number(last.invoice_number.split("-").pop()) : 0;
      const nextSeq = Math.max(lastSeq + 1, 1000);
      return `MCD-${year}-${String(nextSeq).padStart(5, "0")}`;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = customers.data ?? [];
    if (!q) return list;
    return list.filter((c: any) =>
      `${c.first_name ?? ""} ${c.last_name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(q),
    );
  }, [customers.data, search]);

  const filteredLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    const list = library.data ?? [];
    if (!q) return list.slice(0, 50);
    return list
      .filter((i: any) =>
        `${i.sku ?? ""} ${i.name ?? ""} ${i.brand ?? ""} ${i.category ?? ""}`.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [library.data, librarySearch]);

  function lineGross(l: Line) {
    return Number(l.unit || 0) * Number(l.quantity || 0);
  }
  function lineDiscAmt(l: Line) {
    const disc = Math.max(0, Math.min(100, Number(l.discount_pct || 0)));
    return lineGross(l) * (disc / 100);
  }
  function lineNet(l: Line) {
    return lineGross(l) - lineDiscAmt(l);
  }

  const subtotalInc = lines.reduce((s, l) => s + lineNet(l), 0);
  const totalDiscount = lines.reduce((s, l) => s + lineDiscAmt(l), 0);
  const gst = Math.round((subtotalInc * GST_RATE / (1 + GST_RATE)) * 100) / 100;
  const total = Math.round(subtotalInc * 100) / 100;
  const subtotalEx = total - gst;

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((arr) => arr.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((arr) => [...arr, emptyLine()]);
  }
  function removeLine(idx: number) {
    setLines((arr) => arr.filter((_, i) => i !== idx));
  }
  function pickFromLibrary(idx: number, item: any) {
    updateLine(idx, {
      item_code: item.sku ?? "",
      item_name: item.name ?? "",
      description: [item.brand, item.type].filter(Boolean).join(" · "),
      unit: Number(item.unit_price ?? 0),
    });
    setLibraryOpenForIdx(null);
    setLibrarySearch("");
  }
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  function reorder(from: number, to: number) {
    if (from === to) return;
    setLines((arr) => {
      const next = arr.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function createCustomer() {
    if (!ncFirst.trim()) { toast.error("First name required"); return; }
    setCreatingCustomer(true);
    const { data, error } = await supabase
      .from("customers")
      .insert({
        first_name: ncFirst.trim(),
        last_name: ncLast.trim() || "",
        phone: ncPhone.trim() || null,
        email: ncEmail.trim() || null,
      })
      .select("*").maybeSingle();
    setCreatingCustomer(false);
    if (error || !data) { toast.error(error?.message ?? "Failed"); return; }
    toast.success("Customer created");
    await customers.refetch();
    setCustomerId(data.id);
    setShowNewCustomer(false);
    setNcFirst(""); setNcLast(""); setNcPhone(""); setNcEmail("");
  }

  async function save() {
    const cleanLines = lines
      .map((l) => ({
        item_code: l.item_code.trim(),
        item_name: l.item_name.trim(),
        description: l.description.trim(),
        quantity: Number(l.quantity) || 0,
        unit: Number(l.unit) || 0,
        discount_pct: Math.max(0, Math.min(100, Number(l.discount_pct) || 0)),
      }))
      .filter((l) => (l.item_name || l.description || l.item_code) && l.quantity > 0);
    if (cleanLines.length === 0) { toast.error("Add at least one line item"); return; }
    setSaving(true);

    const { data: u } = await supabase.auth.getUser();
    const subInc = cleanLines.reduce((s, l) => s + l.unit * l.quantity * (1 - l.discount_pct / 100), 0);
    const gstAmt = Math.round((subInc * GST_RATE / (1 + GST_RATE)) * 100) / 100;
    const totalAmt = Math.round(subInc * 100) / 100;

    const yr = new Date().getFullYear();
    const { data: last } = await supabase
      .from("invoices")
      .select("invoice_number")
      .like("invoice_number", `MCD-${yr}-%`)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastSeq = last?.invoice_number ? Number(last.invoice_number.split("-").pop()) : 0;
    const nextSeq = Math.max(lastSeq + 1, 1000);
    const invoice_number = `MCD-${yr}-${String(nextSeq).padStart(5, "0")}`;

    // Build legacy `description` for backwards-compatible rendering
    const snapshotLines = cleanLines.map((l) => ({
      ...l,
      description: [l.item_code, l.item_name, l.description].filter(Boolean).join(" — "),
    }));

    const { data, error } = await supabase
      .from("invoices")
      .insert({
        invoice_number,
        customer_id: customerId,
        motorcycle_id: bikeId,
        labour_total: 0,
        parts_total: subInc,
        gst: gstAmt,
        total: totalAmt,
        status: "draft",
        notes: notes.trim() || null,
        invoice_date: invoiceDate,
        snapshot: { line_items: snapshotLines },
        created_by: u.user?.id,
      })
      .select("id, invoice_number").maybeSingle();
    setSaving(false);
    if (error || !data) { toast.error(error?.message ?? "Failed"); return; }
    toast.success(`Invoice ${data.invoice_number} created`);
    nav({ to: "/invoices/$invoiceId", params: { invoiceId: data.id } });
  }

  const selectedCustomer = (customers.data ?? []).find((c: any) => c.id === customerId);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <header className="flex items-center gap-3">
        <button onClick={() => nav({ to: "/invoices" })} className="grid h-9 w-9 place-items-center rounded-lg border border-border">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Billing</div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold truncate">New Invoice</h1>
          <div className="text-sm text-muted-foreground mt-0.5">
            Invoice # <span className="font-mono font-semibold text-foreground">{nextInvoiceNumber.data ?? "…"}</span>
          </div>
        </div>
      </header>

      {/* Customer */}
      <section className="card-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Customer (optional)</div>
          <button
            type="button"
            onClick={() => setShowNewCustomer((v) => !v)}
            className="text-xs text-primary hover:underline"
          >
            {showNewCustomer ? "Cancel" : "+ New customer"}
          </button>
        </div>

        {showNewCustomer && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg border border-border bg-muted/30">
            <Input placeholder="First name *" value={ncFirst} onChange={(e) => setNcFirst(e.target.value)} />
            <Input placeholder="Last name" value={ncLast} onChange={(e) => setNcLast(e.target.value)} />
            <Input placeholder="Phone" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} />
            <Input placeholder="Email" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} />
            <div className="sm:col-span-2 flex justify-end">
              <Button size="sm" onClick={createCustomer} disabled={creatingCustomer}>
                {creatingCustomer ? "Saving…" : "Create customer"}
              </Button>
            </div>
          </div>
        )}

        {selectedCustomer ? (
          <div className="flex items-center justify-between rounded-lg border border-border p-2.5">
            <div className="text-sm">
              <div className="font-semibold">{`${selectedCustomer.first_name ?? ""} ${selectedCustomer.last_name ?? ""}`.trim()}</div>
              <div className="text-xs text-muted-foreground">{selectedCustomer.email ?? selectedCustomer.phone ?? ""}</div>
            </div>
            <button onClick={() => { setCustomerId(null); setBikeId(null); }} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
          </div>
        ) : (
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search customers (leave blank for walk-in)" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {search.trim() && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {filtered.slice(0, 20).map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCustomerId(c.id); setSearch(""); }}
                    className="w-full text-left p-2.5 text-sm hover:bg-muted"
                  >
                    <div className="font-semibold">{`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()}</div>
                    <div className="text-xs text-muted-foreground">{c.email ?? c.phone ?? ""}</div>
                  </button>
                ))}
                {filtered.length === 0 && <div className="p-3 text-xs text-muted-foreground">No matches</div>}
              </div>
            )}
          </div>
        )}

        {customerId && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Bike (optional)</div>
            <select
              value={bikeId ?? ""}
              onChange={(e) => setBikeId(e.target.value || null)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">— none —</option>
              {(bikes.data ?? []).map((b: any) => (
                <option key={b.id} value={b.id}>{fullBike(b as any)}{b.rego ? ` · ${b.rego}` : ""}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* Invoice meta */}
      <section className="card-surface p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Invoice date</Label>
          <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </div>
      </section>

      {/* Line items */}
      <section className="card-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Line items</div>
          <Button type="button" size="sm" variant="outline" onClick={addLine} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add line
          </Button>
        </div>

        {/* Column headers */}
        <div className="hidden md:grid grid-cols-[repeat(24,minmax(0,1fr))] gap-2 px-1 pb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border mb-2">
          <div className="col-span-1"></div>
          <div className="col-span-3">Item code</div>
          <div className="col-span-5">Item name</div>
          <div className="col-span-5">Description</div>
          <div className="col-span-2 text-center">Qty</div>
          <div className="col-span-2 text-right">Unit price</div>
          <div className="col-span-2 text-center">Discount %</div>
          <div className="col-span-3 text-right">Line total</div>
          <div className="col-span-1"></div>
        </div>

        <div className="space-y-3">
          {lines.map((l, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragIdx !== null) reorder(dragIdx, idx); setDragIdx(null); }}
              onDragEnd={() => setDragIdx(null)}
              className={`grid grid-cols-[repeat(24,minmax(0,1fr))] gap-2 items-start rounded-md transition-opacity ${dragIdx === idx ? "opacity-40" : ""}`}
            >
              <div
                className="col-span-1 grid place-items-center h-9 text-muted-foreground cursor-grab active:cursor-grabbing"
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </div>

              {/* Item code (with library picker) */}
              <div className="col-span-24 md:col-span-3 relative">
                <div className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Item code</div>
                <div className="flex gap-1">
                  <Input
                    placeholder="SKU / code"
                    value={l.item_code}
                    onChange={(e) => updateLine(idx, { item_code: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => { setLibraryOpenForIdx(idx); setLibrarySearch(""); }}
                    className="shrink-0 grid place-items-center h-9 w-9 rounded-md border border-border hover:bg-muted text-muted-foreground"
                    title="Pick from inventory library"
                  >
                    <BookOpen className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Item name */}
              <div className="col-span-24 md:col-span-5">
                <div className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Item name</div>
                <Input
                  placeholder="Item name"
                  value={l.item_name}
                  onChange={(e) => updateLine(idx, { item_name: e.target.value })}
                />
              </div>

              {/* Description */}
              <div className="col-span-24 md:col-span-5">
                <div className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Description</div>
                <Input
                  placeholder="Description / notes"
                  value={l.description}
                  onChange={(e) => updateLine(idx, { description: e.target.value })}
                />
              </div>

              {/* Qty */}
              <div className="col-span-6 md:col-span-2">
                <div className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Qty</div>
                <Input
                  type="number" step="0.01" min="0"
                  placeholder="Qty"
                  value={l.quantity}
                  onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                />
              </div>

              {/* Unit $ */}
              <div className="col-span-6 md:col-span-2">
                <div className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Unit $</div>
                <Input
                  type="number" step="0.01" min="0"
                  placeholder="0.00"
                  value={l.unit}
                  onChange={(e) => updateLine(idx, { unit: Number(e.target.value) })}
                />
              </div>

              {/* Discount % */}
              <div className="col-span-6 md:col-span-2">
                <div className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Discount %</div>
                <div className="relative">
                  <Input
                    type="number" step="1" min="0" max="100"
                    placeholder="0"
                    value={l.discount_pct}
                    onChange={(e) => updateLine(idx, { discount_pct: Number(e.target.value) })}
                    className="pr-7 text-center"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">%</span>
                </div>
                {Number(l.discount_pct) > 0 && (
                  <div className="text-[10px] text-emerald-500 mt-0.5 text-center">
                    −${lineDiscAmt(l).toFixed(2)}
                  </div>
                )}
              </div>

              {/* Line total */}
              <div className="col-span-5 md:col-span-3 text-right text-sm tabular-nums pt-2 font-semibold">
                <div className="md:hidden text-[10px] uppercase tracking-wider text-muted-foreground font-normal">Line total</div>
                {Number(l.discount_pct) > 0 && (
                  <div className="text-[10px] text-muted-foreground line-through font-normal">
                    ${lineGross(l).toFixed(2)}
                  </div>
                )}
                ${lineNet(l).toFixed(2)}
              </div>

              <button
                type="button"
                onClick={() => removeLine(idx)}
                className="col-span-1 grid place-items-center h-9 rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40"
                title="Remove line"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5 w-full">
            <Plus className="h-3.5 w-3.5" /> Add another line
          </Button>
        </div>

        <div className="mt-4 pt-3 border-t border-border space-y-1 text-sm max-w-xs ml-auto">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal (excl GST)</span><span className="tabular-nums">${subtotalEx.toFixed(2)}</span></div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-emerald-500"><span>Total discount</span><span className="tabular-nums">−${totalDiscount.toFixed(2)}</span></div>
          )}
          <div className="flex justify-between text-muted-foreground"><span>GST 15% (incl.)</span><span className="tabular-nums">${gst.toFixed(2)}</span></div>
          <div className="flex justify-between pt-1.5 border-t border-border font-display text-lg font-black">
            <span>TOTAL</span><span className="red-gradient-text tabular-nums">${total.toFixed(2)}</span>
          </div>
        </div>
      </section>

      {/* Notes */}
      <section className="card-surface p-4">
        <Label className="text-xs">Notes (optional)</Label>
        <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for the customer" />
      </section>

      <div className="flex items-center justify-end gap-2">
        <Link to="/invoices" className="text-sm text-muted-foreground hover:text-foreground">Cancel</Link>
        <Button onClick={save} disabled={saving} className="red-surface">
          {saving ? "Creating…" : "Create invoice"}
        </Button>
      </div>

      {/* Inventory library picker */}
      {libraryOpenForIdx !== null && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setLibraryOpenForIdx(null)}
        >
          <div
            className="card-surface w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Inventory library</div>
                <div className="font-semibold">Pick an item</div>
              </div>
              <button
                onClick={() => setLibraryOpenForIdx(null)}
                className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by code, name, brand…"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto divide-y divide-border">
              {filteredLibrary.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No items found.</div>
              )}
              {filteredLibrary.map((item: any) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickFromLibrary(libraryOpenForIdx, item)}
                  className="w-full text-left p-3 hover:bg-muted grid grid-cols-12 gap-2 items-center"
                >
                  <div className="col-span-3 font-mono text-xs text-muted-foreground">{item.sku ?? "—"}</div>
                  <div className="col-span-6">
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {[item.brand, item.category, item.type].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="col-span-3 text-right text-sm font-semibold tabular-nums">
                    ${Number(item.unit_price ?? 0).toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
