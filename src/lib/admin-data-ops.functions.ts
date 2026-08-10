import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Privileged customer/motorcycle maintenance operations.
 *
 * The underlying SECURITY DEFINER database functions are no longer callable by
 * signed-in users directly; only the trusted server backend (service role) can
 * execute them, and only after the caller's admin role has been verified here.
 */

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r) => r.role === "admin")) {
    throw new Error("Only admins can perform this action");
  }
  return supabaseAdmin;
}

export const adminDeleteCustomer = createServerFn({ method: "POST" })
  .inputValidator((input: { customerId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("delete_customer_safe", {
      p_customer_id: data.customerId,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const adminDeleteMotorcycle = createServerFn({ method: "POST" })
  .inputValidator((input: { motorcycleId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("delete_motorcycle_safe", {
      p_motorcycle_id: data.motorcycleId,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const adminMergeCustomers = createServerFn({ method: "POST" })
  .inputValidator((input: { keepId: string; mergeId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("merge_customers", {
      p_keep_id: data.keepId,
      p_merge_id: data.mergeId,
    });
    if (error) throw new Error(error.message);
    return result;
  });

export const adminMergeMotorcycles = createServerFn({ method: "POST" })
  .inputValidator((input: { keepId: string; mergeId: string }) => input)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("merge_motorcycles", {
      p_keep_id: data.keepId,
      p_merge_id: data.mergeId,
    });
    if (error) throw new Error(error.message);
    return result;
  });
