import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Shield, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/motorcycle-doctors-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Tile = {
  key: string;
  name: string;
  email: string;
  role: "admin" | "mechanic";
  dedicated?: boolean;
};

const TILES: Tile[] = [
  { key: "admin", name: "Admin", email: "services@mcdr.co.nz", role: "admin" },
  { key: "sebastian", name: "Sebastian", email: "sebastian@mcd.co.nz", role: "mechanic", dedicated: true },
  { key: "dima", name: "Dima", email: "dima@mcd.co.nz", role: "mechanic" },
  { key: "george", name: "George", email: "george@mcd.co.nz", role: "mechanic" },
  { key: "garrice", name: "Garrice", email: "garrice@mcd.co.nz", role: "mechanic", dedicated: true },
  { key: "shaun", name: "Shaun", email: "shaun@mcd.co.nz", role: "mechanic", dedicated: true },
  { key: "boris", name: "Boris", email: "boris@mcd.co.nz", role: "mechanic", dedicated: true },
];

function AuthPage() {
  const nav = useNavigate();
  const [selected, setSelected] = useState<Tile | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advEmail, setAdvEmail] = useState("");
  const [advPassword, setAdvPassword] = useState("");
  const [advName, setAdvName] = useState("");
  const [advMode, setAdvMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/calendar", replace: true });
    });
  }, [nav]);

  async function signInWith(email: string, pwd: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) throw error;
    nav({ to: "/calendar", replace: true });
  }

  async function onTileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    try {
      const cleanedPassword = password.trim();
      const loginPassword =
        selected.role === "mechanic" && /^\d{4}$/.test(cleanedPassword)
          ? `mcd${cleanedPassword}`
          : cleanedPassword;
      await signInWith(selected.email, loginPassword);
    } catch (err: any) {
      toast.error(err.message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  async function onAdvSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (advMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: advEmail,
          password: advPassword,
          options: { emailRedirectTo: window.location.origin, data: { full_name: advName } },
        });
        if (error) throw error;
        toast.success("Account created");
      }
      await signInWith(advEmail, advPassword);
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <img src={logoAsset.url} alt="Motorcycle Doctors" className="mx-auto h-24 w-24 object-contain mb-3" />
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">The Shop</div>
          <h1 className="font-display text-3xl font-bold mt-1">
            <span className="gold-gradient-text">Motorcycle Doctors</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Pick who's signing in.</p>
        </div>

        {!selected && !showAdvanced && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TILES.map((t) => {
                const isAdmin = t.role === "admin";
                return (
                  <button
                    key={t.key}
                    onClick={() => {
                      setSelected(t);
                      setPassword("");
                    }}
                    className={cn(
                      "card-surface p-4 flex flex-col items-center gap-2 hover:scale-[1.03] transition-transform group",
                      isAdmin && "ring-1 ring-primary/40",
                      t.dedicated && !isAdmin && "ring-1 ring-amber-500/40",
                    )}
                  >
                    <div
                      className={cn(
                        "h-14 w-14 rounded-full grid place-items-center font-display text-xl font-bold",
                        isAdmin ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
                      )}
                    >
                      {t.name[0]}
                    </div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      {isAdmin ? <Shield className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                      {isAdmin ? "Admin" : "Mechanic"}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="text-center mt-6">
              <button
                onClick={() => setShowAdvanced(true)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Sign in with a different email
              </button>
            </div>
          </>
        )}

        {selected && (
          <div className="card-surface p-6 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="h-3 w-3" /> Back to user picker
            </button>
            <div className="flex items-center gap-3 mb-5">
              <div
                className={cn(
                  "h-12 w-12 rounded-full grid place-items-center font-display text-lg font-bold",
                  selected.role === "admin" ? "bg-primary/15 text-primary" : "bg-muted",
                )}
              >
                {selected.name[0]}
              </div>
              <div>
                <div className="font-semibold">{selected.name}</div>
                <div className="text-xs text-muted-foreground">{selected.email}</div>
              </div>
            </div>
            <form onSubmit={onTileSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pwd">{selected.role === "mechanic" ? "PIN" : "Password"}</Label>
                <Input
                  id="pwd"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
                {selected.role === "mechanic" && (
                  <p className="text-[11px] text-muted-foreground">Default PIN is <span className="font-mono font-bold">1234</span>.</p>
                )}
              </div>
              <Button type="submit" className="w-full red-surface h-11 font-semibold" disabled={loading}>
                {loading ? "Signing in…" : `Enter as ${selected.name}`}
              </Button>
            </form>
          </div>
        )}

        {showAdvanced && (
          <div className="card-surface p-6 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setShowAdvanced(false)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="h-3 w-3" /> Back to user picker
            </button>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted mb-5">
              <button
                type="button"
                onClick={() => setAdvMode("signin")}
                className={`rounded-md py-2 text-sm font-semibold transition-colors ${advMode === "signin" ? "bg-card text-foreground" : "text-muted-foreground"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setAdvMode("signup")}
                className={`rounded-md py-2 text-sm font-semibold transition-colors ${advMode === "signup" ? "bg-card text-foreground" : "text-muted-foreground"}`}
              >
                Create account
              </button>
            </div>
            <form onSubmit={onAdvSubmit} className="space-y-4">
              {advMode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="adv-name">Full name</Label>
                  <Input id="adv-name" value={advName} onChange={(e) => setAdvName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="adv-email">Email</Label>
                <Input id="adv-email" type="email" value={advEmail} onChange={(e) => setAdvEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adv-pwd">Password</Label>
                <Input
                  id="adv-pwd"
                  type="password"
                  value={advPassword}
                  onChange={(e) => setAdvPassword(e.target.value)}
                  required
                  minLength={4}
                />
              </div>
              <Button type="submit" className="w-full gold-surface h-11 font-semibold" disabled={loading}>
                {loading ? "Working…" : advMode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
