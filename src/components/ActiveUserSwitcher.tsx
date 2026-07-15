import { useEffect, useState } from "react";
import { Users, Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  useTechnicians,
  useActiveTechnicianId,
  setActiveTechnicianId,
  type Technician,
} from "@/hooks/use-active-technician";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ActiveUserSwitcher() {
  const { technicians, loading } = useTechnicians();
  const activeId = useActiveTechnicianId();
  const active = technicians.find((t) => t.id === activeId) ?? null;

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [target, setTarget] = useState<Technician | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Keep active label in sync with the currently signed-in user.
  useEffect(() => {
    if (loading || !authUserId) return;
    const me = technicians.find((t) => t.id === authUserId);
    if (me && activeId !== authUserId) {
      setActiveTechnicianId(authUserId);
    } else if (!activeId && technicians.length > 0) {
      setActiveTechnicianId(technicians[0].id);
    }
  }, [loading, activeId, technicians, authUserId]);

  function onPick(t: Technician) {
    if (t.id === authUserId) return; // already signed in as this user
    if (!t.email) {
      toast.error("This user has no email on file — cannot switch.");
      return;
    }
    setTarget(t);
    setPassword("");
  }

  async function confirmSwitch(e: React.FormEvent) {
    e.preventDefault();
    if (!target?.email) return;
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: target.email,
      password,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Incorrect password");
      return;
    }
    setActiveTechnicianId(target.id);
    toast.success(`Switched to ${target.full_name}`);
    setTarget(null);
    setPassword("");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/80 px-2.5 py-2 text-sm font-medium text-foreground hover:border-foreground/30 transition-colors"
          title="Active user"
        >
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="hidden md:inline max-w-[140px] truncate">
            {active ? active.full_name : "Select user"}
          </span>
          <span className="md:hidden grid h-6 w-6 place-items-center rounded-full bg-muted text-[10px] font-semibold">
            {initials(active?.full_name ?? "?")}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Switch user</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {loading && <div className="px-2 py-3 text-xs text-muted-foreground">Loading…</div>}
          {!loading && technicians.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground">No staff found</div>
          )}
          {technicians.map((t) => {
            const selected = t.id === authUserId;
            return (
              <DropdownMenuItem
                key={t.id}
                onSelect={(e) => {
                  e.preventDefault();
                  onPick(t);
                }}
                className="flex items-center gap-2"
              >
                <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-[10px] font-semibold">
                  {initials(t.full_name)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm font-medium">{t.full_name}</span>
                  <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t.role}
                  </span>
                </span>
                <Check
                  className={cn(
                    "h-4 w-4 text-primary transition-opacity",
                    selected ? "opacity-100" : "opacity-0",
                  )}
                />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign in as {target?.full_name}</DialogTitle>
            <DialogDescription>
              Enter the password for <span className="font-medium">{target?.email}</span> to switch
              users.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={confirmSwitch} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="switch-pw">Password</Label>
              <Input
                id="switch-pw"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !password}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Switch
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
