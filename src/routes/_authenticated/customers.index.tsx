/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Phone,
  Mail,
  ChevronRight,
  Bike,
  X,
  Archive,
  ArchiveRestore,
  Merge,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { displayCustomerName } from "@/lib/display";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  duplicateGroups,
  duplicateIds,
  hasPhone,
  isCustomerSuspicious,
  isCustomerValid,
  normalizePhone,
} from "@/lib/data-quality";

export const Route = createFileRoute("/_authenticated/customers/")({
  component: Customers,
});

type Filter = "all" | "valid" | "missing_phone" | "suspicious" | "duplicate_phone" | "archived";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "valid", label: "Valid" },
  { key: "missing_phone", label: "Missing phone" },
  { key: "suspicious", label: "Suspicious" },
  { key: "duplicate_phone", label: "Duplicate phone" },
  { key: "archived", label: "Archived" },
];

function Customers() {
  const qc = useQueryClient();
  const { isAdmin } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortAlpha, setSortAlpha] = useState(false);
  const [onlyWithBikes, setOnlyWithBikes] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [mergePair, setMergePair] = useState<{ keep: any; merge: any } | null>(null);
  const [f, setF] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  const customers = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () =>
      await fetchAllRows((from, to) =>
        supabase
          .from("customers")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, to),
      ),
  });

  const bikes = useQuery({
    queryKey: ["customers-bikes"],
    queryFn: async () =>
      await fetchAllRows((from, to) =>
        supabase
          .from("motorcycles")
          .select("id, customer_id, make, model, year, rego")
          .range(from, to),
      ),
  });

  const bikesByCustomer = new Map<string, any[]>();
  for (const b of bikes.data ?? []) {
    const arr = bikesByCustomer.get(b.customer_id) ?? [];
    arr.push(b);
    bikesByCustomer.set(b.customer_id, arr);
  }

  const rows: any[] = useMemo(() => customers.data ?? [], [customers.data]);
  const active = useMemo(() => rows.filter((c) => !c.is_archived), [rows]);

  const phoneGroups = useMemo(
    () => duplicateGroups(active, (c: any) => normalizePhone(c.phone)),
    [active],
  );
  const dupIds = useMemo(() => duplicateIds(phoneGroups as Map<string, any[]>), [phoneGroups]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      valid: active.filter((c) => isCustomerValid(c)).length,
      missing_phone: active.filter((c) => !hasPhone(c.phone)).length,
      suspicious: active.filter((c) => isCustomerSuspicious(c)).length,
      duplicate_phone: dupIds.size,
      archived: rows.filter((c) => c.is_archived).length,
    }),
    [rows, active, dupIds],
  );

  async function save() {
    if (!f.first_name.trim()) return toast.error("First name required");
    if (!hasPhone(f.phone)) return toast.error("A valid phone number is required");
    const payload = { ...f, last_name: f.last_name.trim() || null };
    const { error } = await supabase.from("customers").insert(payload);
    if (error) return toast.error(error.message);
    setF({ first_name: "", last_name: "", phone: "", email: "", address: "", notes: "" });
    setOpen(false);
    toast.success("Customer added");
    qc.invalidateQueries({ queryKey: ["customers-list"] });
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["customers-list"] });
    qc.invalidateQueries({ queryKey: ["customers-bikes"] });
    qc.invalidateQueries({ queryKey: ["customers-options"] });
    qc.invalidateQueries({ queryKey: ["bikes-list"] });
  }

  async function archiveSelected(archived: boolean) {
    if (!isAdmin) return toast.error("Admin only");
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await (supabase as any)
      .from("customers")
      .update({ is_archived: archived })
      .in("id", ids);
    if (error) return toast.error(error.message);
    setSelected(new Set());
    toast.success(`${ids.length} ${archived ? "archived" : "restored"}`);
    refresh();
  }

  async function permanentDeleteSelected() {
    if (!isAdmin) return toast.error("Admin only");
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (
      !confirm(
        `Permanently delete ${ids.length} customer(s)?\n\nOnly customers with no bikes, bookings, jobs, invoices or claims can be deleted. Others will be skipped.`,
      )
    )
      return;
    let ok = 0;
    const blocked: string[] = [];
    for (const id of ids) {
      const { error } = await (supabase as any).rpc("delete_customer_safe", {
        p_customer_id: id,
      });
      if (error) blocked.push(id);
      else ok++;
    }
    setSelected(new Set());
    if (ok) toast.success(`${ok} permanently deleted`);
    if (blocked.length)
      toast.error(
        `${blocked.length} kept: they have linked history (bikes, bookings, jobs, invoices or claims). Archive them instead.`,
      );
    refresh();
  }

  let filtered = active;
  if (filter === "archived") filtered = rows.filter((c) => c.is_archived);
  else if (filter === "valid") filtered = active.filter((c) => isCustomerValid(c));
  else if (filter === "missing_phone") filtered = active.filter((c) => !hasPhone(c.phone));
  else if (filter === "suspicious") filtered = active.filter((c) => isCustomerSuspicious(c));
  else if (filter === "duplicate_phone") filtered = active.filter((c) => dupIds.has(c.id));

  filtered = filtered.filter((c: any) =>
    `${displayCustomerName(c, "")} ${c.phone ?? ""} ${c.email ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  if (onlyWithBikes) {
    filtered = filtered.filter((c: any) => (bikesByCustomer.get(c.id) ?? []).length > 0);
  }
  if (sortAlpha) {
    filtered = [...filtered].sort((a: any, b: any) =>
      `${a.first_name ?? ""} ${a.last_name ?? ""}`
        .trim()
        .toLowerCase()
        .localeCompare(`${b.first_name ?? ""} ${b.last_name ?? ""}`.trim().toLowerCase()),
    );
  }

  const dupGroupList = useMemo(
    () =>
      Array.from(phoneGroups.entries())
        .map(([key, group]) => ({ key, group: group as any[] }))
        .sort((a, b) => b.group.length - a.group.length),
    [phoneGroups],
  );

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/50 space-y-3">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Customers
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold">
              {filtered.length}
              {filtered.length !== counts.all ? ` / ${counts.all}` : ""} riders
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && selectMode ? (
              <>
                {filter === "archived" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => archiveSelected(false)}
                    disabled={selected.size === 0}
                    className="gap-1.5 shrink-0"
                  >
                    <ArchiveRestore className="h-4 w-4" /> Restore
                    {selected.size > 0 ? ` (${selected.size})` : ""}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => archiveSelected(true)}
                    disabled={selected.size === 0}
                    className="gap-1.5 shrink-0"
                  >
                    <Archive className="h-4 w-4" /> Archive
                    {selected.size > 0 ? ` (${selected.size})` : ""}
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={permanentDeleteSelected}
                  disabled={selected.size === 0}
                  className="gap-1.5 shrink-0"
                >
                  <Trash2 className="h-4 w-4" /> Delete
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
                <Button
                  onClick={() => setOpen((o) => !o)}
                  className="gold-surface gap-1.5 shrink-0"
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </>
            )}
          </div>
        </header>

        {/* Data quality counts */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {(
            [
              ["Valid", counts.valid, "valid"],
              ["Missing phone", counts.missing_phone, "missing_phone"],
              ["Suspicious", counts.suspicious, "suspicious"],
              ["Duplicates", counts.duplicate_phone, "duplicate_phone"],
              ["Archived", counts.archived, "archived"],
            ] as [string, number, Filter][]
          ).map(([label, value, key]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${
                filter === key
                  ? "border-primary/60 bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="text-sm font-semibold">{value}</div>
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground truncate">
                {label}
              </div>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email"
            className="w-full rounded-xl bg-card border border-border pl-10 pr-3 py-3 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map((ff) => (
            <button
              key={ff.key}
              type="button"
              onClick={() => setFilter(ff.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === ff.key
                  ? "bg-primary/10 border-primary/60 text-foreground"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {ff.label}
            </button>
          ))}
          <span className="w-px h-5 bg-border mx-1" />
          <button
            type="button"
            onClick={() => setSortAlpha((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${sortAlpha ? "bg-primary/10 border-primary/60 text-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
          >
            A–Z
          </button>
          <button
            type="button"
            onClick={() => setOnlyWithBikes((v) => !v)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1 ${onlyWithBikes ? "bg-primary/10 border-primary/60 text-foreground" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
          >
            <Bike className="h-3 w-3" /> With bikes
          </button>
        </div>
      </div>

      {open && (
        <div className="card-surface p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="First name *"
              value={f.first_name}
              onChange={(e) => setF({ ...f, first_name: e.target.value })}
            />
            <Input
              placeholder="Last name (optional)"
              value={f.last_name}
              onChange={(e) => setF({ ...f, last_name: e.target.value })}
            />
          </div>
          <Input
            placeholder="Phone *"
            inputMode="tel"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
          />
          <Input
            placeholder="Email (optional)"
            type="email"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
          />
          <Input
            placeholder="Address"
            value={f.address}
            onChange={(e) => setF({ ...f, address: e.target.value })}
          />
          <Textarea
            placeholder="Notes"
            rows={2}
            value={f.notes}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
          />
          <Button onClick={save} className="gold-surface w-full">
            Save customer
          </Button>
        </div>
      )}

      {filter === "duplicate_phone" && (
        <div className="space-y-2">
          {dupGroupList.length === 0 && (
            <div className="card-surface p-6 text-center text-sm text-muted-foreground">
              No duplicate phone numbers found.
            </div>
          )}
          {dupGroupList.map(({ key, group }) => (
            <div key={key} className="card-surface p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" /> {key} · {group.length} records
              </div>
              <div className="space-y-1.5">
                {group.map((c: any, idx: number) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5"
                  >
                    <Link
                      to="/customers/$customerId"
                      params={{ customerId: c.id }}
                      className="min-w-0 flex-1 text-sm truncate hover:text-primary"
                    >
                      {c.first_name} {c.last_name ?? ""}
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {(bikesByCustomer.get(c.id) ?? []).length} bikes
                      </span>
                    </Link>
                    {idx === 0 ? (
                      <span className="text-[0.625rem] uppercase tracking-wider text-primary">
                        Keep
                      </span>
                    ) : (
                      isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 h-7 text-xs"
                          onClick={() => setMergePair({ keep: group[0], merge: c })}
                        >
                          <Merge className="h-3 w-3" /> Merge into first
                        </Button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {filter !== "duplicate_phone" && (
        <div className="space-y-2">
          {isAdmin && selectMode && filtered.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                id="select-all-customers"
                checked={selected.size === filtered.length}
                onCheckedChange={(checked) =>
                  setSelected(checked ? new Set(filtered.map((c: any) => c.id)) : new Set())
                }
              />
              <label
                htmlFor="select-all-customers"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                Select all
              </label>
            </div>
          )}
          {filtered.map((c: any) => {
            const cBikes = bikesByCustomer.get(c.id) ?? [];
            const checked = selected.has(c.id);
            const suspicious = isCustomerSuspicious(c);
            const noPhone = !hasPhone(c.phone);
            const toggle = () =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(c.id)) next.delete(c.id);
                else next.add(c.id);
                return next;
              });
            const rowClass = `card-surface p-3 flex items-center gap-3 hover:border-primary/50 transition-colors ${
              selectMode && checked ? "border-primary/60 bg-primary/5" : ""
            } ${selectMode ? "cursor-pointer" : ""} ${c.is_archived ? "opacity-60" : ""}`;
            const inner = (
              <>
                {isAdmin && selectMode && (
                  <Checkbox checked={checked} className="pointer-events-none" tabIndex={-1} />
                )}
                <span className="grid h-11 w-11 place-items-center rounded-full bg-muted font-semibold">
                  {initials(`${c.first_name} ${c.last_name ?? ""}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate flex items-center gap-1.5">
                    {c.first_name}
                    {c.last_name ? ` ${c.last_name}` : ""}
                    {c.is_archived && (
                      <span className="text-[0.625rem] uppercase tracking-wider rounded px-1 py-0.5 border border-border text-muted-foreground">
                        Archived
                      </span>
                    )}
                    {suspicious && (
                      <span className="inline-flex items-center gap-0.5 text-[0.625rem] uppercase tracking-wider rounded px-1 py-0.5 border border-amber-500/40 text-amber-500">
                        <AlertTriangle className="h-2.5 w-2.5" /> Suspicious
                      </span>
                    )}
                    {noPhone && (
                      <span className="text-[0.625rem] uppercase tracking-wider rounded px-1 py-0.5 border border-destructive/40 text-destructive">
                        No phone
                      </span>
                    )}
                    {dupIds.has(c.id) && (
                      <span className="text-[0.625rem] uppercase tracking-wider rounded px-1 py-0.5 border border-primary/40 text-primary">
                        Dup
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {c.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" />
                        {c.email}
                      </span>
                    )}
                  </div>
                  {cBikes.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {cBikes.map((b) => (
                        <span
                          key={b.id}
                          className="inline-flex items-center gap-1 rounded-md bg-muted/60 border border-border/60 px-1.5 py-0.5 text-[0.625rem] text-foreground/80"
                        >
                          <Bike className="h-3 w-3 text-primary" />
                          {b.make} {b.model}
                          {b.year ? ` ${b.year}` : ""}
                          {b.rego ? ` · ${b.rego}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {!selectMode && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </>
            );
            if (selectMode) {
              return (
                <div
                  key={c.id}
                  className={rowClass}
                  role="button"
                  tabIndex={0}
                  onClick={toggle}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggle();
                    }
                  }}
                >
                  {inner}
                </div>
              );
            }
            return (
              <Link
                key={c.id}
                to="/customers/$customerId"
                params={{ customerId: c.id }}
                className={rowClass}
              >
                {inner}
              </Link>
            );
          })}
          {filtered.length === 0 && (
            <div className="card-surface p-8 text-center text-sm text-muted-foreground">
              No customers match this filter.
            </div>
          )}
        </div>
      )}

      {mergePair && (
        <MergeDialog
          keep={mergePair.keep}
          merge={mergePair.merge}
          onClose={() => setMergePair(null)}
          onDone={() => {
            setMergePair(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function MergeDialog({
  keep,
  merge,
  onClose,
  onDone,
}: {
  keep: any;
  merge: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const counts = useQuery({
    queryKey: ["customer-refs", merge.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("customer_reference_counts", {
        p_customer_id: merge.id,
      });
      if (error) throw error;
      return data as Record<string, number>;
    },
  });

  async function run() {
    setBusy(true);
    const { error } = await (supabase as any).rpc("merge_customers", {
      p_keep_id: keep.id,
      p_merge_id: merge.id,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Customers merged");
    onDone();
  }

  const name = (c: any) => `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
  const c = counts.data ?? {};

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div className="card-surface w-full max-w-md p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Merge customers</h2>
          <button onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            Keeping
          </div>
          <div className="font-semibold">{name(keep)}</div>
          <div className="text-xs text-muted-foreground">{keep.phone ?? "—"}</div>
        </div>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            Merging &amp; removing
          </div>
          <div className="font-semibold">{name(merge)}</div>
          <div className="text-xs text-muted-foreground">{merge.phone ?? "—"}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["Motorcycles", c["motorcycles"]],
            ["Bookings", c["bookings"]],
            ["Jobs", c["jobs"]],
            ["Invoices", c["invoices"]],
            ["Insurance claims", c["insurance_claims"]],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-md border border-border bg-muted/30 px-2 py-1.5"
            >
              <div className="font-semibold">{counts.isLoading ? "…" : (value ?? 0)}</div>
              <div className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          All of the above history is moved to the kept customer. Nothing is deleted except the
          duplicate customer record itself.
        </p>
        <div className="flex gap-2">
          <Button onClick={run} disabled={busy} className="gold-surface flex-1">
            {busy ? "Merging…" : "Merge"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
