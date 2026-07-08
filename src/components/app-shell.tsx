import { Link, Outlet, useRouterState, useNavigate, useRouter } from "@tanstack/react-router";
import { CalendarDays, Wrench, Bike, Timer, LogOut, ClipboardList, FileText, Settings as SettingsIcon, BarChart3, ShieldCheck, KeyRound, ArrowLeft } from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/motorcycle-doctors-logo.png.asset.json";
import { ActiveUserSwitcher } from "@/components/ActiveUserSwitcher";
import { FloatingClockWidget } from "@/components/FloatingClockWidget";
import { ServiceLegend } from "@/components/ServiceLegend";
import { NotificationsBell } from "@/components/NotificationsBell";

// macOS-dock-like magnification based on cursor proximity to each item center
// Keeps label text at its original size by scaling the inner text inversely.
function useDockMagnify() {
  const navRef = useRef<HTMLElement | null>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const onMove = useCallback((e: React.MouseEvent) => {
    const rect = navRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMouseY(e.clientY - rect.top);
  }, []);
  const onLeave = useCallback(() => setMouseY(null), []);
  const getScale = (el: HTMLElement | null) => {
    if (!el || mouseY == null || !navRef.current) return 1;
    const navRect = navRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const center = r.top - navRect.top + r.height / 2;
    const dist = Math.abs(mouseY - center);
    const influence = 120; // px radius of magnification
    if (dist > influence) return 1;
    const t = 1 - dist / influence; // 0..1
    const eased = (1 - Math.cos(t * Math.PI)) / 2; // smooth cosine ease
    return 1 + eased * 0.18; // up to ~1.18x
  };
  return { navRef, onMove, onLeave, getScale };
}

function DockItem({
  getScale,
  children,
}: {
  getScale: (el: HTMLElement | null) => number;
  children: (ref: (el: HTMLElement | null) => void, scale: number) => React.ReactNode;
}) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const scale = getScale(el);
  return <>{children(setEl, scale)}</>;
}

export function AppShell() {
  const nav = useNavigate();
  const router = useRouter();
  const { fullName, isAdmin, isTechnician, loading: userLoading } = useCurrentUser();
  const roleLabel = isAdmin ? "Admin" : isTechnician ? "Technician" : "No Role";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const sidebarDock = useDockMagnify();

  // Show floating back button everywhere on mobile except on the main landing pages
  const isRootPage = pathname === "/" || pathname === "/calendar";
  const showMobileBack = !isRootPage;


  const tabs = isAdmin
    ? [
        { to: "/calendar", label: "Calendar", icon: CalendarDays, color: "#60a5fa" },
        { to: "/bookings", label: "Bookings", icon: ClipboardList, color: "#f472b6" },
        { to: "/jobs", label: "Jobs", icon: Wrench, color: "#fb923c" },
        { to: "/motorcycles", label: "Bikes", icon: Bike, color: "#facc15" },
        { to: "/clock", label: "Clock", icon: Timer, color: "#34d399" },
        { to: "/invoices", label: "Invoices", icon: FileText, color: "#22d3ee" },
        { to: "/insurance", label: "Insurance", icon: ShieldCheck, color: "#a78bfa" },
        { to: "/loan-bikes", label: "Loan", icon: KeyRound, color: "#f59e0b" },
        { to: "/analytics", label: "Analytics", icon: BarChart3, color: "#4ade80" },
        { to: "/settings", label: "Settings", icon: SettingsIcon, color: "#94a3b8" },
      ]
    : [
        { to: "/calendar", label: "Calendar", icon: CalendarDays, color: "#60a5fa" },
        { to: "/jobs", label: "Job Cards", icon: Wrench, color: "#fb923c" },
        { to: "/clock", label: "Clock", icon: Timer, color: "#34d399" },
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
          <button
            onClick={() => router.history.back()}
            className="hidden sm:grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
            aria-label="Go back"
            title="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
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

      {/* ===== MOBILE FLOATING BACK BUTTON ===== */}
      {showMobileBack && (
        <button
          onClick={() => router.history.back()}
          className="fixed left-4 z-50 sm:hidden grid h-10 w-10 place-items-center rounded-full border border-border bg-background/90 backdrop-blur shadow-lg text-muted-foreground hover:text-foreground"
          style={{ top: "76px" }}
          aria-label="Go back"
          title="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}


      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside className="hidden sm:flex fixed left-0 top-[80px] z-40 w-[220px] h-[calc(100vh-80px)] flex-col border-r border-border/60 bg-card/80 backdrop-blur-xl text-sidebar-foreground" style={{ overflow: "visible" }}>
        <div className="px-4 pt-4 pb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-sidebar-foreground/50">
          Main Menu
        </div>
        <nav
          ref={sidebarDock.navRef}
          onMouseMove={sidebarDock.onMove}
          onMouseLeave={sidebarDock.onLeave}
          className="flex-1 flex flex-col gap-1 p-3 pt-1"
          style={{ overflow: "visible" }}
        >
          {tabs.map((t) => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <DockItem key={t.to} getScale={sidebarDock.getScale}>
                {(setRef, scale) => (
                  <Link
                    ref={setRef as never}
                    to={t.to}
                    style={{
                      transform: `scale(${scale})`,
                      transformOrigin: "left center",
                      transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), z-index 0s",
                      position: "relative",
                      zIndex: scale > 1.01 ? 50 + Math.round(scale * 10) : 1,
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium will-change-transform",
                      active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                    )}
                  >
                    <Icon
                      className="h-5 w-5 shrink-0"
                      style={{ color: active ? undefined : t.color, filter: `drop-shadow(0 0 6px ${t.color}55)` }}
                    />
                    <span
                      className="origin-left"
                      style={{ transform: scale > 1 ? `scale(${1 / scale})` : undefined, transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)" }}
                    >
                      {t.label}
                    </span>
                  </Link>
                )}
              </DockItem>
            );
          })}
        </nav>
        {pathname === "/calendar" && (
          <div className="p-3 border-t border-border/60">
            <ServiceLegend />
          </div>
        )}
      </aside>

      {/* ===== MAIN ===== */}
      <main className="flex-1 px-4 pt-5 pb-28 sm:pb-5 sm:ml-[220px]">
        <Outlet />
      </main>

      <FloatingClockWidget />

      {/* ===== MOBILE BOTTOM NAV ===== */}
      <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="flex overflow-x-auto overflow-y-hidden scrollbar-hide snap-x snap-mandatory">
          {tabs.map((t) => {
            const active = pathname === t.to || pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-3 px-4 text-[10px] uppercase tracking-wider transition-colors shrink-0 snap-start min-w-[72px]",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon
                  className="h-6 w-6"
                  style={{ color: t.color, filter: `drop-shadow(0 0 6px ${t.color}66)` }}
                />

                <span className="font-semibold whitespace-nowrap">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
