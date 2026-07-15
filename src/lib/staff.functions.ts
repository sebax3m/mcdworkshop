import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StaffOption = { id: string; email: string; full_name: string; role: string };

export const listStaffEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffOption[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only admins may list staff emails.
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "technician"]);
    if (rErr) throw rErr;
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    if (ids.length === 0) return [];
    const { data: profiles, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", ids);
    if (pErr) throw pErr;
    const roleByUser = new Map<string, string>();
    (roles ?? []).forEach((r) => {
      const existing = roleByUser.get(r.user_id);
      if (!existing || r.role === "admin") roleByUser.set(r.user_id, r.role);
    });
    return (profiles ?? [])
      .filter((p) => !!p.email)
      .map((p) => ({
        id: p.id,
        email: p.email as string,
        full_name: p.full_name ?? (p.email as string),
        role: roleByUser.get(p.id) ?? "technician",
      }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  });
