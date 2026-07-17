/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  RefreshCw,
  Mail,
  Clock,
  Pencil,
  Star,
  UserPlus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { listUsersWithLogins, updateUserDetails, type UserLoginRow } from "@/lib/users.functions";
import { seedStaff } from "@/lib/seed-staff.functions";
import { createTechnician } from "@/lib/create-technician.functions";
import { resetUserPassword } from "@/lib/reset-user-password.functions";
import { deleteUser } from "@/lib/delete-user.functions";


import { initials } from "@/lib/format";
import { useActiveTechnicianId, setActiveTechnicianId } from "@/hooks/use-active-technician";
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
  const createTechFn = useServerFn(createTechnician);


  const activeId = useActiveTechnicianId();
  const [editing, setEditing] = useState<UserLoginRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "technician">("all");
  const [sortBy, setSortBy] = useState<"name" | "role" | "last_sign_in">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleHeaderClick = (field: "name" | "role" | "last_sign_in") => {
    if (sortBy === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDirection("asc");
    }
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["users-login-logs"],
    queryFn: () => fetchUsers({ data: undefined }),
  });

  const raw = data ?? [];
  const filtered = raw.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "name") {
      cmp = (a.full_name ?? "").localeCompare(b.full_name ?? "");
    } else if (sortBy === "role") {
      cmp = (a.role ?? "").localeCompare(b.role ?? "");
    } else if (sortBy === "last_sign_in") {
      const at = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
      const bt = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
      cmp = at - bt;
    }
    return sortDirection === "asc" ? cmp : -cmp;
  });
  // Active user pinned to top
  const users = sorted.sort((a, b) => {
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
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const r = await seedStaff({ data: undefined });
                const created = r.results.filter((x) => x.status === "created");
                const exists = r.results.filter((x) => x.status === "exists").length;
                const errs = r.results.filter((x) => x.status === "error");
                toast.success(
                  `Staff seeded — ${created.length} created, ${exists} already existed${errs.length ? `, ${errs.length} errors` : ""}`,
                );
                // New accounts get a strong random password. Surface it once so
                // the admin can hand it over out-of-band; it is not stored on
                // the client and cannot be retrieved later.
                for (const c of created) {
                  if (c.temporary_password) {
                    toast.message(`Temporary password for ${c.email}`, {
                      description: c.temporary_password,
                      duration: 60000,
                    });
                  }
                }
                if (errs.length) console.error(errs);
                refetch();
              } catch (e: any) {
                toast.error(e.message ?? "Failed to seed staff");
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg red-surface px-3 py-2 text-sm font-semibold"
          >
            <UserPlus className="h-4 w-4" />
            Seed workshop staff
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:border-foreground/30"
          >
            <UserPlus className="h-4 w-4" />
            Add user
          </button>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-foreground/30"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="card-surface p-4 text-sm text-destructive">{(error as Error).message}</div>
      )}

      {!isLoading && raw.length > 0 && (
        <div className="card-surface p-3 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as "all" | "admin" | "technician")}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="technician">Technician</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="name">Sort: Name (A–Z)</option>
            <option value="role">Sort: Role</option>
            <option value="recent">Sort: Most recent sign in</option>
            <option value="oldest">Sort: Oldest sign in</option>
          </select>
          {(search || roleFilter !== "all" || sortBy !== "name") && (
            <button
              onClick={() => {
                setSearch("");
                setRoleFilter("all");
                setSortBy("name");
              }}
              className="rounded-md border border-border px-3 py-2 text-xs hover:border-foreground/30"
            >
              Clear
            </button>
          )}
          <div className="text-xs text-muted-foreground ml-auto">
            {users.length} of {raw.length}
          </div>
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
                    <span title={fullDate(u.last_sign_in_at)}>{formatWhen(u.last_sign_in_at)}</span>
                  </div>
                  <div className="flex md:justify-end items-center gap-2 flex-wrap">
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
        Only admins can view this page. "Last sign in" comes from authentication records.
      </p>

      {editing && <EditUserDialog user={editing} onClose={() => setEditing(null)} />}
      {addOpen && (
        <AddUserDialog
          onClose={() => setAddOpen(false)}
          onCreated={() => {
            setAddOpen(false);
            refetch();
          }}
          createTechFn={createTechFn}
        />
      )}
    </div>
  );
}

function AddUserDialog({
  onClose,
  onCreated,
  createTechFn,
}: {
  onClose: () => void;
  onCreated: () => void;
  createTechFn: (args: { data: { email: string; full_name: string; password: string } }) => Promise<unknown>;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    setErr(null);
    if (!fullName.trim()) return setErr("Full name is required");
    if (!email.trim()) return setErr("Email is required");
    if (password.length < 6) return setErr("Password must be at least 6 characters");
    setSaving(true);
    try {
      await createTechFn({ data: { email: email.trim(), full_name: fullName.trim(), password } });
      toast.success(`${fullName} created`);
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card-surface w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-semibold">Add user</h2>
        <div className="space-y-3">
          <label className="block text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">Password</span>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
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
            {saving ? "Creating…" : "Create user"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditUserDialog({ user, onClose }: { user: UserLoginRow; onClose: () => void }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateUserDetails);
  const resetPwdFn = useServerFn(resetUserPassword);
  const deleteFn = useServerFn(deleteUser);
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [role, setRole] = useState<"admin" | "technician">(
    user.role === "admin" ? "admin" : "technician",
  );
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  async function handleResetPassword() {
    setErr(null);
    if (newPassword.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }
    setResetting(true);
    try {
      await resetPwdFn({ data: { userId: user.id, password: newPassword } });
      toast.success(`Password reset for ${user.full_name}`);
      setNewPassword("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete user ${user.full_name}? This cannot be undone.`)) return;
    setErr(null);
    setDeleting(true);
    try {
      await deleteFn({ data: { userId: user.id } });
      toast.success(`${user.full_name} deleted`);
      await qc.invalidateQueries({ queryKey: ["users-login-logs"] });
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="card-surface w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-semibold">Edit user</h2>

        <div className="space-y-3">
          <label className="block text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">Full name</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "technician")}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="technician">Technician</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Reset password
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={handleResetPassword}
              disabled={resetting || !newPassword}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:border-foreground/30 disabled:opacity-50"
            >
              {resetting ? "Resetting…" : "Reset"}
            </button>
          </div>
        </div>

        {err && <div className="text-sm text-destructive">{err}</div>}

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 text-destructive px-3 py-2 text-sm font-medium hover:bg-destructive/10 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? "Deleting…" : "Delete user"}
          </button>
          <div className="flex gap-2">
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
    </div>
  );

}
