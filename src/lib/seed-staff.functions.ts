import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const STAFF_ROSTER = [
  { email: "sebastian@mcd.co.nz", full_name: "Sebastian" },
  { email: "dima@mcd.co.nz", full_name: "Dima" },
  { email: "george@mcd.co.nz", full_name: "George" },
  { email: "garrice@mcd.co.nz", full_name: "Garrice" },
  { email: "shaun@mcd.co.nz", full_name: "Shaun" },
  { email: "boris@mcd.co.nz", full_name: "Boris" },
] as const;

// Generate a cryptographically-strong per-user password. Never hardcode a
// shared default: it would leak through the source tree and mean every seeded
// account had identical, publicly-known credentials.
function generateStrongPassword(): string {
  // 24 random bytes → 32 base64url chars; well above Supabase's minimum and
  // meets HIBP/leaked-password checks.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const seedStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (callerRoles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Only admins can seed workshop staff");

    // Build a map of existing emails so we can skip
    const existing = new Map<string, string>();
    let page = 1;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        if (u.email) existing.set(u.email.toLowerCase(), u.id);
      }
      if (data.users.length < 200) break;
      page += 1;
      if (page > 20) break;
    }

    const results: Array<{
      email: string;
      status: "created" | "exists" | "error";
      message?: string;
      // Only returned for freshly-created accounts. Existing accounts keep
      // whatever password they already had — re-seeding must NOT reset it.
      temporary_password?: string;
    }> = [];

    for (const member of STAFF_ROSTER) {
      const found = existing.get(member.email.toLowerCase());
      if (found) {
        // Ensure profile + role, but leave the password alone. Rotating on
        // every seed would let anyone who can call this endpoint kick every
        // technician out of their account.
        await supabaseAdmin.from("profiles").upsert({
          id: found,
          email: member.email,
          full_name: member.full_name,
        });
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: found, role: "technician" }, { onConflict: "user_id,role" });
        results.push({ email: member.email, status: "exists" });
        continue;
      }
      const tempPassword = generateStrongPassword();
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: member.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: member.full_name },
      });
      if (error || !data.user) {
        results.push({
          email: member.email,
          status: "error",
          message: error?.message ?? "unknown",
        });
        continue;
      }
      await supabaseAdmin.from("profiles").upsert({
        id: data.user.id,
        email: member.email,
        full_name: member.full_name,
      });
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.user.id, role: "technician" }, { onConflict: "user_id,role" });
      // Return the temporary password only to the admin who invoked the seed
      // so they can hand it to the technician for first sign-in / reset.
      results.push({ email: member.email, status: "created", temporary_password: tempPassword });
    }
    return { results };
  });
