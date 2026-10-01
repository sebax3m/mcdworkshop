import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { data: callerRoles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error("Could not verify admin access");
    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Only admins can delete users");

    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Keep the auth ID so historical clock events, job time and authorship remain intact.
    // This is irreversible for the account, but does not cascade-delete workshop history.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId, true);
    if (error) throw new Error(error.message);

    // A deleted account must not retain an admin or technician role, even if an old token exists.
    const { error: revokeError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId);
    if (revokeError) throw new Error("Account deleted, but role removal failed. Contact an administrator.");
    return { ok: true };
  });
