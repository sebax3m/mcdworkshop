import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createTechnician = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; full_name: string; password: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Only admins can create technicians");

    // If a user with that email exists, reuse it and ensure the tech role + password
    let userId: string | null = null;
    let page = 1;
    outer: while (true) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error(error.message);
      for (const u of list.users) {
        if (u.email?.toLowerCase() === data.email.toLowerCase()) {
          userId = u.id;
          break outer;
        }
      }
      if (list.users.length < 200) break;
      page += 1;
      if (page > 20) break;
    }

    if (userId) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: data.password,
      });
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");
      userId = created.user.id;
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email: data.email, full_name: data.full_name });
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "technician" }, { onConflict: "user_id,role" });

    return { user_id: userId, email: data.email };
  });
