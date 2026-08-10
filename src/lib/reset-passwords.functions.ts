import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Never hardcode shared passwords. Each reset generates a unique,
// cryptographically-random password that is returned once to the invoking
// admin so it can be handed to that single user.
function generateStrongPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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

    const results: Array<{
      user_id: string;
      role: string;
      status: "ok" | "error";
      message?: string;
      // Unique one-time password, only shown to the admin who ran the reset.
      temporary_password?: string;
    }> = [];
    for (const [userId, role] of roleByUser) {
      const password = generateStrongPassword();
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
      if (error) results.push({ user_id: userId, role, status: "error", message: error.message });
      else results.push({ user_id: userId, role, status: "ok", temporary_password: password });
    }
    return { results };
  });
