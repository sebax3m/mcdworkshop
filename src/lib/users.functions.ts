import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserLoginRow = {
  id: string;
  email: string | null;
  full_name: string;
  role: string;
  last_sign_in_at: string | null;
  created_at: string | null;
};

export const listUsersWithLogins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserLoginRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify caller is admin (admin client bypasses RLS)
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Only admins can view login records");

    // Pull auth users (paginated)
    const authUsers: Array<{
      id: string;
      email: string | null;
      last_sign_in_at: string | null;
      created_at: string | null;
    }> = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        authUsers.push({
          id: u.id,
          email: u.email ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          created_at: u.created_at ?? null,
        });
      }
      if (data.users.length < 200) break;
      page += 1;
      if (page > 20) break;
    }

    const ids = authUsers.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);

    const profById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const roleById = new Map<string, string>();
    for (const r of roles ?? []) {
      const existing = roleById.get(r.user_id);
      if (!existing || r.role === "admin") roleById.set(r.user_id, r.role);
    }

    return authUsers
      .map((u) => {
        const p = profById.get(u.id);
        return {
          id: u.id,
          email: u.email ?? p?.email ?? null,
          full_name: p?.full_name || p?.email || u.email || "Unnamed",
          role: roleById.get(u.id) ?? "user",
          last_sign_in_at: u.last_sign_in_at,
          created_at: u.created_at,
        };
      })
      .sort((a, b) => {
        const at = a.last_sign_in_at ? Date.parse(a.last_sign_in_at) : 0;
        const bt = b.last_sign_in_at ? Date.parse(b.last_sign_in_at) : 0;
        return bt - at;
      });
  });

export const updateUserDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    userId: string;
    full_name?: string;
    email?: string;
    role?: "admin" | "technician";
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Only admins can edit users");

    if (data.email) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        email: data.email,
      });
      if (error) throw new Error(error.message);
    }

    const profileUpdate: { full_name?: string; email?: string } = {};
    if (data.full_name !== undefined) profileUpdate.full_name = data.full_name;
    if (data.email !== undefined) profileUpdate.email = data.email;
    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
