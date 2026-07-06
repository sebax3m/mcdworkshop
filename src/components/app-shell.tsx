import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Wrench, Bike, Timer, LogOut, ClipboardList, FileText, Settings as SettingsIcon, BarChart3, ShieldCheck, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/motorcycle-doctors-logo.png.asset.json";
import { ActiveUserSwitcher } from "@/components/ActiveUserSwitcher";
import { FloatingClockWidget } from "@/components/FloatingClockWidget";

export function AppShell() {
  const nav = useNavigate();
  const { fullName, isAdmin, isTechnician, loading: userLoading } = useCurrentUser();
  const roleLabel = isAdmin ? "Admin" : isTechnician ? "Technician" : "No Role";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = isAdmin
    ? [
        { to: "/calendar", label: "Calendar", icon: CalendarDays },
        { to: "/bookings", label: "Bookings", icon: ClipboardList },
        { to: "/jobs", label: "Jobs", icon: Wrench },
        { to: "/motorcycles", label: "Bikes", icon: Bike },
        { to: "/clock", label: "Clock", icon: Timer },
      ]
    : [
        { to: "/calendar", label: "Calendar", icon: CalendarDays },
        { to: "/jobs", label: "Job Cards", icon: Wrench },
        { to: "/clock", label: "Clock", icon: Timer },
      ];

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/calendar" className="flex items-center gap-2.5 min-w-0 group">
            <img
              src={logoAsset.url}
              alt="Motorcycle Doctors"
              className="h-14 w-auto shrink-0 drop-shadow-[0_0_12px_oklch(0.58_0.22_25/0.35)] transition-transform group-hover:scale-105"
            />
            <div className="hidden sm:block min-w-0">
              <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground leading-none">Workshop OS</div>
              <div className="font-display text-sm font-bold tracking-wide truncate">Motorcycle Doctors</div>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ActiveUserSwitcher />
            {isAdmin && (
              <Link
                to="/bookings/new"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg red-surface px-3 py-2 text-sm font-semibold hover:scale-[1.02] transition-transform"
              >
                Book In
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/invoices/new"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg red-surface px-3 py-2 text-sm font-semibold hover:scale-[1.02] transition-transform"
              >
                Invoice
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/jobs/new"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg red-surface px-3 py-2 text-sm font-semibold hover:scale-[1.02] transition-transform"
              >
                Job Card
              </Link>
            )}
            {!userLoading && (
              <span
                className={cn(
                  "hidden xs:inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                  isAdmin
                    ? "border-primary/40 bg-primary/10 text-primary shadow-[0_0_12px_-2px_oklch(0.58_0.22_25/0.45)]"
                    : isTechnician
                      ? "border-border bg-muted text-foreground"
                      : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
                title={`Signed in as ${roleLabel}`}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", isAdmin ? "bg-primary" : isTechnician ? "bg-foreground/60" : "bg-destructive")} />
                {roleLabel}
              </span>
            )}
            <div
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-muted text-xs font-semibold"
              title={fullName ? `${fullName} · ${roleLabel}` : roleLabel}
            >
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

      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside className="hidden sm:flex fixed left-0 top-[80px] z-20 w-[220px] h-[calc(100vh-80px)] flex-col border-r border-border/60 bg-card/80 backdrop-blur-xl overflow-y-auto">
        <div className="px-4 pt-4 pb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
          Main Menu
        </div>
        <nav className="flex-1 flex flex-col gap-1 p-3 pt-1">
          {tabs.map((t) => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {t.label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              to="/invoices"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/invoices")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <FileText className="h-5 w-5 shrink-0" /> Invoices
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/insurance"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/insurance")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <ShieldCheck className="h-5 w-5 shrink-0" /> Insurance
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/loan-bikes"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/loan-bikes")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <KeyRound className="h-5 w-5 shrink-0" /> Loan Bikes
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/analytics"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/analytics")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <BarChart3 className="h-5 w-5 shrink-0" /> Analytics
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/settings"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/settings") ||
                  pathname.startsWith("/templates") ||
                  pathname.startsWith("/inventory") ||
                  pathname.startsWith("/customers")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <SettingsIcon className="h-5 w-5 shrink-0" /> Settings
            </Link>
          )}
        </nav>
      </aside>

      {/* ===== MAIN ===== */}
      <main className="flex-1 px-4 pt-5 pb-28 sm:pb-5 sm:ml-[220px]">
        <Outlet />
      </main>

      <FloatingClockWidget />

      {/* ===== MOBILE BOTTOM NAV ===== */}
      <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-border bg-background/95 backdrop-blur-xl">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >

          {tabs.map((t) => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 text-xs uppercase tracking-wider transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-6 w-6", active && "drop-shadow-[0_0_8px_oklch(0.58_0.22_25/0.6)]")} />
                <span className="font-semibold">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
