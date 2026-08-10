/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { adminDeleteMotorcycle, adminMergeMotorcycles } from "@/lib/admin-data-ops.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Merge, Sparkles, Trash2, X, AlertTriangle } from "lucide-react";
import { fullBike } from "@/lib/format";
import {
  duplicateGroups,
  isBikeSuspicious,
  normalizeRego,
  normalizeVin,
} from "@/lib/data-quality";

type Bike = any;

type Props = {
  bikes: Bike[];
  isAdmin: boolean;
  onClose: () => void;
  onDone: () => void;
};

/** Score used to pick the best record of a duplicate group (higher = keep). */
function completeness(b: Bike): number {
  let s = 0;
  if (b.customer_id) s += 5;
  if (String(b.make ?? "").trim()) s += 2;
  if (String(b.model ?? "").trim()) s += 2;
  if (b.year) s += 1;
  if (String(b.vin ?? "").trim()) s += 1;
  if (String(b.rego ?? "").trim()) s += 1;
  if (Array.isArray(b.photos) && b.photos.length) s += 1;
  if (b.mileage) s += 1;
  if (b.is_archived) s -= 3;
  if (isBikeSuspicious(b)) s -= 2;
  return s;
}

function ownerName(b: Bike) {
  return b.customers ? `${b.customers.first_name ?? ""} ${b.customers.last_name ?? ""}`.trim() : "";
}

/**
 * Garage clean-up tool: merges duplicate bikes (same rego / same VIN) into a
 * single record and offers one-click purges for archived, owner-less and
 * suspicious rows. Deletes go through `delete_motorcycle_safe`, so bikes with
 * linked history are archived instead of destroyed.
 */
export function BikeCleanupDialog({ bikes, isAdmin, onClose, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const active = useMemo(() => bikes.filter((b) => !b.is_archived), [bikes]);

  const groups = useMemo(() => {
    const out: { key: string; label: string; rows: Bike[] }[] = [];
    const seen = new Set<string>();
    const byRego = duplicateGroups(active, (b: Bike) => normalizeRego(b.rego));
    for (const [k, rows] of byRego) {
      out.push({ key: `rego:${k}`, label: `Rego ${k}`, rows });
      rows.forEach((r: Bike) => seen.add(r.id));
    }
    const byVin = duplicateGroups(active, (b: Bike) => normalizeVin(b.vin));
    for (const [k, rows] of byVin) {
      if (rows.every((r: Bike) => seen.has(r.id))) continue;
      out.push({ key: `vin:${k}`, label: `VIN ${k}`, rows });
    }
    return out;
  }, [active]);

  const archived = useMemo(() => bikes.filter((b) => b.is_archived), [bikes]);
  const noOwner = useMemo(() => active.filter((b) => !b.customer_id), [active]);
  const suspicious = useMemo(() => active.filter((b) => isBikeSuspicious(b)), [active]);
  const incomplete = useMemo(
    () =>
      active.filter(
        (b) =>
          !b.customer_id ||
          !String(b.rego ?? "").trim() ||
          !String(b.make ?? "").trim() ||
          !String(b.model ?? "").trim() ||
          isBikeSuspicious(b),
      ),
    [active],
  );

  async function mergeGroup(rows: Bike[]) {
    if (!isAdmin) return toast.error("Admin only");
    const sorted = [...rows].sort((a, b) => completeness(b) - completeness(a));
    const keep = sorted[0];
    setBusy(true);
    try {
      let merged = 0;
      for (const r of sorted.slice(1)) {
        await adminMergeMotorcycles({ data: { keepId: keep.id, mergeId: r.id } });
        merged++;
      }
      toast.success(`${merged} duplicate(s) merged into ${fullBike(keep)}`);
      onDone();
    } catch (err: any) {
      toast.error(err.message ?? "Merge failed");
    } finally {
      setBusy(false);
    }
  }

  async function mergeAll() {
    if (!isAdmin) return toast.error("Admin only");
    if (!confirm(`Merge every duplicate group (${groups.length})? History is kept on the winner.`))
      return;
    setBusy(true);
    let merged = 0;
    let failed = 0;
    try {
      for (let i = 0; i < groups.length; i++) {
        setProgress(`Merging group ${i + 1}/${groups.length}…`);
        const sorted = [...groups[i].rows].sort((a, b) => completeness(b) - completeness(a));
        const keep = sorted[0];
        for (const r of sorted.slice(1)) {
          try {
            await adminMergeMotorcycles({ data: { keepId: keep.id, mergeId: r.id } });
            merged++;
          } catch {
            failed++;
          }
        }
      }
      if (merged) toast.success(`${merged} duplicate bike(s) merged`);
      if (failed) toast.error(`${failed} could not be merged`);
      onDone();
    } finally {
      setProgress("");
      setBusy(false);
    }
  }

  /** Delete when possible, archive when the bike still has linked history. */
  async function purge(rows: Bike[], label: string, archiveFallback = true) {
    if (!isAdmin) return toast.error("Admin only");
    if (rows.length === 0) return;
    if (
      !confirm(
        `Remove ${rows.length} ${label}?\n\nBikes with bookings, jobs or invoices cannot be deleted — they will be ${
          archiveFallback ? "archived instead" : "skipped"
        }.`,
      )
    )
      return;
    setBusy(true);
    let deleted = 0;
    const blocked: string[] = [];
    try {
      for (let i = 0; i < rows.length; i++) {
        setProgress(`Removing ${i + 1}/${rows.length}…`);
        try {
          await adminDeleteMotorcycle({ data: { motorcycleId: rows[i].id } });
          deleted++;
        } catch {
          blocked.push(rows[i].id);
        }
      }
      if (archiveFallback && blocked.length) {
        await (supabase as any)
          .from("motorcycles")
          .update({ is_archived: true })
          .in("id", blocked);
      }
      toast.success(
        `${deleted} deleted${blocked.length ? `, ${blocked.length} archived (linked history)` : ""}`,
      );
      onDone();
    } finally {
      setProgress("");
      setBusy(false);
    }
  }

  /** Hard-delete archived rows: no fallback, they are already parked. */
  async function purgeArchived() {
    await purge(archived, "archived bike(s)", false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div className="w-full max-w-3xl max-h-[88vh] overflow-y-auto card-surface p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Garage clean-up
            </h2>
            <p className="text-xs text-muted-foreground">
              Merge duplicates and remove junk records. Only bikes with an owner, a rego and a
              real make/model are kept.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {progress && <div className="text-xs text-primary">{progress}</div>}

        {/* Bulk actions */}
        <div className="grid sm:grid-cols-2 gap-2">
          <CleanupAction
            title="Merge duplicates"
            count={groups.length}
            hint="Same rego or VIN → one record, history preserved"
            disabled={busy || !isAdmin || groups.length === 0}
            onClick={mergeAll}
            icon={<Merge className="h-3.5 w-3.5" />}
          />
          <CleanupAction
            title="Delete archived"
            count={archived.length}
            hint="Permanently removes archived bikes"
            disabled={busy || !isAdmin || archived.length === 0}
            onClick={purgeArchived}
            destructive
            icon={<Trash2 className="h-3.5 w-3.5" />}
          />
          <CleanupAction
            title="Delete bikes with no owner"
            count={noOwner.length}
            hint="Orphan records with no customer linked"
            disabled={busy || !isAdmin || noOwner.length === 0}
            onClick={() => purge(noOwner, "bike(s) with no owner")}
            destructive
            icon={<Trash2 className="h-3.5 w-3.5" />}
          />
          <CleanupAction
            title="Delete suspicious"
            count={suspicious.length}
            hint="Placeholder make/model (test, unknown, numbers…)"
            disabled={busy || !isAdmin || suspicious.length === 0}
            onClick={() => purge(suspicious, "suspicious bike(s)")}
            destructive
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
          />
        </div>

        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
          <div className="text-sm font-semibold">Keep only complete bikes</div>
          <p className="text-xs text-muted-foreground">
            Removes every bike missing an owner, a rego or a valid make/model —{" "}
            <strong>{incomplete.length}</strong> record(s). Bikes with linked history are archived
            instead of deleted.
          </p>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy || !isAdmin || incomplete.length === 0}
            onClick={() => purge(incomplete, "incomplete bike(s)")}
            className="gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clean up {incomplete.length}
          </Button>
        </div>

        {/* Duplicate groups */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Duplicate groups ({groups.length})
          </div>
          {groups.length === 0 && (
            <div className="text-sm text-muted-foreground">No duplicates found.</div>
          )}
          {groups.map((g) => {
            const sorted = [...g.rows].sort((a, b) => completeness(b) - completeness(a));
            return (
              <div key={g.key} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold">{g.label}</div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={busy || !isAdmin}
                    onClick={() => mergeGroup(g.rows)}
                  >
                    <Merge className="h-3 w-3" /> Merge {g.rows.length}
                  </Button>
                </div>
                <div className="space-y-1">
                  {sorted.map((b, i) => (
                    <div key={b.id} className="flex items-center gap-2 text-xs">
                      <span
                        className={`rounded px-1 py-0.5 border ${
                          i === 0
                            ? "border-primary/50 text-primary"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {i === 0 ? "Keep" : "Merge"}
                      </span>
                      <span className="font-medium truncate">{fullBike(b)}</span>
                      <span className="text-muted-foreground truncate">
                        {ownerName(b) || "no owner"}
                        {b.rego ? ` · ${b.rego}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {!isAdmin && (
          <div className="text-xs text-destructive">
            Clean-up actions are available to admins only.
          </div>
        )}
      </div>
    </div>
  );
}

function CleanupAction({
  title,
  count,
  hint,
  onClick,
  disabled,
  destructive,
  icon,
}: {
  title: string;
  count: number;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
        destructive
          ? "border-destructive/40 hover:bg-destructive/10"
          : "border-primary/40 hover:bg-primary/10"
      }`}
    >
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        {icon} {title}
        <span className="ml-auto tabular-nums">{count}</span>
      </div>
      <div className="text-[0.7rem] text-muted-foreground">{hint}</div>
    </button>
  );
}
