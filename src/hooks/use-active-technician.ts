import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Technician = { id: string; full_name: string; email: string | null; role: string };

const STORAGE_KEY = "activeTechnicianId";
const EVENT = "active-technician-changed";

export function setActiveTechnicianId(id: string | null) {
  if (id) localStorage.setItem(STORAGE_KEY, id);
  else localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useActiveTechnicianId() {
  const [id, setId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY),
  );
  useEffect(() => {
    const h = () => setId(localStorage.getItem(STORAGE_KEY));
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return id;
}

export function useTechnicians() {
  const [list, setList] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "technician"]);
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) {
      setList([]);
      setLoading(false);
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    const roleByUser = new Map<string, string>();
    (roles ?? []).forEach((r) => {
      // admin wins over technician for label
      const existing = roleByUser.get(r.user_id);
      if (!existing || r.role === "admin") roleByUser.set(r.user_id, r.role);
    });
    const out: Technician[] = (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name || p.email || "Unnamed",
      email: p.email,
      role: roleByUser.get(p.id) ?? "technician",
    }));
    out.sort((a, b) => a.full_name.localeCompare(b.full_name));
    setList(out);
    setLoading(false);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { technicians: list, loading, reload };
}
