import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resetUserPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; password: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Only admins can reset passwords");

    if (!data.password || data.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
