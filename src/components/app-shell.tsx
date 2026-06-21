import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Wrench, Users, Bike, Timer, LogOut, Plus, FileStack } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AppShell() {
  const nav = useNavigate();
  const { fullName, isAdmin } = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    { to: "/dashboard", label: "Today", icon: LayoutDashboard },
    { to: "/jobs", label: "Jobs", icon: Wrench },
    { to: "/clock", label: "Clock", icon: Timer },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/motorcycles", label: "Bikes", icon: Bike },
  ];

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg gold-surface font-bold">G</div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground leading-none">The Garage</div>
              <div className="font-display text-sm font-semibold truncate">Performance Workshop</div>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {isAdmin && (
              <Link
                to="/jobs/new"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg gold-surface px-3 py-2 text-sm font-semibold"
              >
                <Plus className="h-4 w-4" /> New Job
              </Link>
            )}
            <div className="grid h-9 w-9 place-items-center rounded-full border border-border bg-muted text-xs font-semibold">
              {initials(fullName)}
            </div>
            <button
              onClick={signOut}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 pt-5 pb-32 sm:pb-10">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="grid grid-cols-5">
          {tabs.map((t) => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] uppercase tracking-wider transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_oklch(0.81_0.13_82/0.6)]")} />
                <span className="font-semibold">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop side tabs (top secondary nav) */}
      <nav className="hidden sm:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-40 items-center gap-1 rounded-full border border-border bg-card/90 px-1.5 py-1.5 backdrop-blur-xl shadow-[0_10px_40px_-10px_oklch(0_0_0/0.6)]">
        {tabs.map((t) => {
          const active = pathname === t.to || pathname.startsWith(t.to + "/");
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            to="/templates"
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/templates")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <FileStack className="h-4 w-4" /> Templates
          </Link>
        )}
      </nav>
    </div>
  );
}