import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
  head: () => ({
    meta: [
      { title: "My Account | Motorcycle Doctors Workshop" },
      {
        name: "description",
        content: "Update your workshop profile name and change your account password.",
      },
      { property: "og:title", content: "My Account | Motorcycle Doctors Workshop" },
      {
        property: "og:description",
        content: "Update your workshop profile name and change your account password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AccountPage() {
  const { user, fullName, isAdmin, isTechnician, loading } = useCurrentUser();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    setName(fullName);
  }, [fullName]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setPhone(data?.phone ?? "");
      });
    return () => {
      active = false;
    };
  }, [user]);

  async function saveProfile() {
    if (!user) return;
    if (!name.trim()) return toast.error("Name is required");
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim(), phone: phone.trim() || null })
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  }

  async function changePassword() {
    if (pw1.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw1 !== pw2) return toast.error("Passwords do not match");
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setSavingPw(false);
    if (error) return toast.error(error.message);
    setPw1("");
    setPw2("");
    toast.success("Password changed");
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <header>
        <div className="text-[0.625rem] uppercase tracking-[0.3em] text-muted-foreground">Settings</div>
        <h1 className="font-display text-3xl font-bold">My Account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {user?.email} · {isAdmin ? "Admin" : isTechnician ? "Technician" : "No role"}
        </p>
      </header>

      <section className="card-surface p-5 space-y-4">
        <h2 className="font-display text-lg font-bold">Profile</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-muted-foreground">Full name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          onClick={saveProfile}
          disabled={savingProfile}
          className="rounded-lg red-surface px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {savingProfile ? "Saving…" : "Save profile"}
        </button>
      </section>

      <section className="card-surface p-5 space-y-4">
        <h2 className="font-display text-lg font-bold">Change password</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-muted-foreground">New password</span>
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Confirm password</span>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <button
          onClick={changePassword}
          disabled={savingPw}
          className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-foreground/30 disabled:opacity-60"
        >
          {savingPw ? "Updating…" : "Update password"}
        </button>
      </section>
    </div>
  );
}
