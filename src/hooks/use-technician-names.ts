import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Shared, cached id → full name map for staff (technicians + admins). */
let cache: Map<string, string> | null = null;
let inflight: Promise<Map<string, string>> | null = null;
const listeners = new Set<(m: Map<string, string>) => void>();

async function load(): Promise<Map<string, string>> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase.from("profiles").select("id, full_name, email");
    const map = new Map<string, string>();
    (data ?? []).forEach((p) => map.set(p.id, p.full_name || p.email || "Staff"));
    cache = map;
    inflight = null;
    listeners.forEach((l) => l(map));
    return map;
  })();
  return inflight;
}

export function useTechnicianNames() {
  const [names, setNames] = useState<Map<string, string>>(() => cache ?? new Map());
  useEffect(() => {
    let alive = true;
    load().then((m) => alive && setNames(m));
    const l = (m: Map<string, string>) => alive && setNames(new Map(m));
    listeners.add(l);
    return () => {
      alive = false;
      listeners.delete(l);
    };
  }, []);
  return names;
}

/** "Sebastian Rojas" → "SR" (single word → first letter). */
export function initialsOf(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}
