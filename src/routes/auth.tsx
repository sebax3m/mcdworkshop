import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoAsset from "@/assets/motorcycle-doctors-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/calendar", replace: true });
    });
  }, [nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created — signing you in");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      nav({ to: "/calendar", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={logoAsset.url}
            alt="Motorcycle Doctors"
            className="mx-auto h-28 w-28 object-contain mb-4"
          />
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">The Shop</div>
          <h1 className="font-display text-3xl font-bold mt-1">
            <span className="gold-gradient-text">Motorcycle Doctors</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Workshop OS — built for speed.</p>
        </div>

        <div className="card-surface p-6">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted mb-6">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`rounded-md py-2 text-sm font-semibold transition-colors ${mode === "signin" ? "bg-card text-foreground" : "text-muted-foreground"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-md py-2 text-sm font-semibold transition-colors ${mode === "signup" ? "bg-card text-foreground" : "text-muted-foreground"}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Jay Smith" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full gold-surface h-11 font-semibold" disabled={loading}>
              {loading ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            First account becomes the workshop admin. New signups join as technicians.
          </p>
        </div>
      </div>
    </div>
  );
}