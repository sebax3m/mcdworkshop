import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "technician";

export interface CurrentUser {
  user: User | null;
  roles: Role[];
  isAdmin: boolean;
  isTechnician: boolean;
  loading: boolean;
  fullName: string;
}

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      const u = data.user ?? null;
      setUser(u);
      if (u) {
        const [{ data: r }, { data: p }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", u.id),
          supabase.from("profiles").select("full_name").eq("id", u.id).maybeSingle(),
        ]);
        if (!active) return;
        setRoles((r ?? []).map((x) => x.role as Role));
        setFullName(p?.full_name || u.email || "");
      } else {
        setRoles([]);
        setFullName("");
      }
      setLoading(false);
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    roles,
    isAdmin: roles.includes("admin"),
    isTechnician: roles.includes("technician"),
    loading,
    fullName,
  };
}