import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TECH_PASSWORD = "Moto26";
const ADMIN_PASSWORD = "MCDR26";

export const resetStaffPasswords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Only admins can reset passwords");

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "technician"]);
    if (rErr) throw new Error(rErr.message);

    // Admin wins if a user has both roles
    const roleByUser = new Map<string, "admin" | "technician">();
    for (const r of roles ?? []) {
      const cur = roleByUser.get(r.user_id);
      if (r.role === "admin" || !cur) roleByUser.set(r.user_id, r.role as "admin" | "technician");
    }

    const results: Array<{ user_id: string; role: string; status: "ok" | "error"; message?: string }> = [];
    for (const [userId, role] of roleByUser) {
      const password = role === "admin" ? ADMIN_PASSWORD : TECH_PASSWORD;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) results.push({ user_id: userId, role, status: "error", message: error.message });
      else results.push({ user_id: userId, role, status: "ok" });
    }
    return { results, tech_password: TECH_PASSWORD, admin_password: ADMIN_PASSWORD };
  });
