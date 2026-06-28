import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, RefreshCw, Mail, Clock, Pencil, Star, UserPlus } from "lucide-react";
import { listUsersWithLogins, updateUserDetails, type UserLoginRow } from "@/lib/users.functions";
import { seedStaff } from "@/lib/seed-staff.functions";
import { initials } from "@/lib/format";
import {
  useActiveTechnicianId,
  setActiveTechnicianId,
} from "@/hooks/use-active-technician";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function formatWhen(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function fullDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function UsersPage() {
  const fetchUsers = useServerFn(listUsersWithLogins);
  const activeId = useActiveTechnicianId();
  const [editing, setEditing] = useState<UserLoginRow | null>(null);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["users-login-logs"],
    queryFn: () => fetchUsers({ data: undefined }),
  });

  const raw = data ?? [];
  // Active user pinned to top
  const users = [...raw].sort((a, b) => {
    if (a.id === activeId && b.id !== activeId) return -1;
    if (b.id === activeId && a.id !== activeId) return 1;
    return 0;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
      </div>

      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Workshop
          </div>
          <h1 className="font-display text-3xl font-bold">Users & Logins</h1>
          <p className="text-sm text-muted-foreground mt-1">
            See who has signed in, switch the active user, and edit their details.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-foreground/30"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="card-surface p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="card-surface p-8 text-center text-muted-foreground text-sm">
          Loading users…
        </div>
      ) : users.length === 0 ? (
        <div className="card-surface p-8 text-center text-muted-foreground text-sm">
          No users found.
        </div>
      ) : (
        <div className="card-surface overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_1fr_110px_160px_200px] gap-3 px-4 py-3 border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
            <div>User</div>
            <div>Email</div>
            <div>Role</div>
            <div>Last sign in</div>
            <div className="text-right">Actions</div>
          </div>
          <ul className="divide-y divide-border">
            {users.map((u) => {
              const isActive = u.id === activeId;
              return (
                <li
                  key={u.id}
                  className={cn(
                    "grid grid-cols-1 md:grid-cols-[1fr_1fr_110px_160px_200px] gap-3 px-4 py-3 items-center",
                    isActive && "bg-primary/5",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-muted text-xs font-semibold shrink-0">
                      {initials(u.full_name)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-1.5">
                        {u.full_name}
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary text-[9px] uppercase tracking-wider px-1.5 py-0.5">
                            <Star className="h-2.5 w-2.5 fill-current" /> Active
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground md:hidden truncate">
                        {u.email}
                      </div>
                    </div>
                  </div>
                  <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{u.email ?? "—"}</span>
                  </div>
                  <div>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                        u.role === "admin"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {u.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span title={fullDate(u.last_sign_in_at)}>
                      {formatWhen(u.last_sign_in_at)}
                    </span>
                  </div>
                  <div className="flex md:justify-end items-center gap-2">
                    <button
                      onClick={() => setEditing(u)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-foreground/30"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setActiveTechnicianId(u.id)}
                      disabled={isActive}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        isActive
                          ? "border-primary/40 bg-primary/10 text-primary cursor-default"
                          : "border-border hover:border-foreground/30",
                      )}
                    >
                      {isActive ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Active
                        </>
                      ) : (
                        "Switch to"
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Only admins can view this page. "Last sign in" comes from authentication
        records.
      </p>

      {editing && (
        <EditUserDialog user={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function EditUserDialog({
  user,
  onClose,
}: {
  user: UserLoginRow;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateUserDetails);
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [role, setRole] = useState<"admin" | "technician">(
    user.role === "admin" ? "admin" : "technician",
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      await updateFn({
        data: {
          userId: user.id,
          full_name: fullName,
          email: email || undefined,
          role,
        },
      });
      await qc.invalidateQueries({ queryKey: ["users-login-logs"] });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card-surface w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-semibold">Edit user</h2>

        <div className="space-y-3">
          <label className="block text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">
              Full name
            </span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">
              Role
            </span>
            <select
              value={role}
              onChange={(e) =>
                setRole(e.target.value as "admin" | "technician")
              }
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="technician">Technician</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>

        {err && <div className="text-sm text-destructive">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm hover:border-foreground/30"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
