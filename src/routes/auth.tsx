/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import logoAsset from "@/assets/motorcycle-doctors-logo.png.asset.json";
import { listStaffEmails } from "@/lib/staff.functions";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showReset, setShowReset] = useState(false);

  const fetchStaff = useServerFn(listStaffEmails);
  const { data: staff = [] } = useQuery({
    queryKey: ["auth", "staff-emails"],
    queryFn: () => fetchStaff(),
    staleTime: 60_000,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/calendar", replace: true });
    });
  }, [nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      nav({ to: "/calendar", replace: true });
    } catch (err: any) {
      // Return a generic message: never confirm whether an email exists.
      toast.error("Invalid email or password");
      if (err?.message) console.error("sign-in failed:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Always show the same success message so the form can't be used to
      // enumerate which emails have accounts.
      toast.success("If that email is registered, a reset link has been sent.");
      setShowReset(false);
      setResetEmail("");
    } catch {
      toast.success("If that email is registered, a reset link has been sent.");
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
            className="mx-auto h-24 w-24 object-contain mb-3"
          />
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Staff Sign-in
          </div>
          <h1 className="font-display text-3xl font-bold mt-1">
            <span className="gold-gradient-text">Motorcycle Doctors</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Authorised workshop staff only.</p>
        </div>

        {!showReset ? (
          <form onSubmit={onSubmit} className="card-surface p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              {staff.length > 0 ? (
                <Select value={email} onValueChange={setEmail}>
                  <SelectTrigger id="email" autoFocus>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const admins = staff.filter((s) => s.role === "admin");
                      const techs = staff.filter((s) => s.role !== "admin");
                      return (
                        <>
                          {admins.length > 0 && (
                            <>
                              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Admins
                              </div>
                              {admins.map((s) => (
                                <SelectItem key={s.id} value={s.email}>
                                  <span className="font-medium">{s.full_name}</span>
                                  <span className="text-muted-foreground"> — {s.email}</span>
                                </SelectItem>
                              ))}
                            </>
                          )}
                          {techs.length > 0 && (
                            <>
                              {admins.length > 0 && <div className="my-1 h-px bg-border" />}
                              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Technicians
                              </div>
                              {techs.map((s) => (
                                <SelectItem key={s.id} value={s.email}>
                                  <span className="font-medium">{s.full_name}</span>
                                  <span className="text-muted-foreground"> — {s.email}</span>
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pwd">Password</Label>
              <Input
                id="pwd"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full red-surface h-11 font-semibold"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Forgot password?
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center pt-2 border-t border-border/50">
              Accounts are created by an administrator. If you need access, contact the workshop
              admin.
            </p>
          </form>
        ) : (
          <form onSubmit={onReset} className="card-surface p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full gold-surface h-11 font-semibold"
              disabled={loading}
            >
              {loading ? "Sending…" : "Send reset link"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowReset(false)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
