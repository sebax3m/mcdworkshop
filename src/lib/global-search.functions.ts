import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ query: z.string().max(100) });

export type BookingSearchResult = {
  type: "booking";
  id: string;
  title: string;
  subtitle: string;
  date: string | null;
};

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}

export const globalSearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string }) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<BookingSearchResult[]> => {
    const q = data.query.trim();
    if (!q || q.length < 2) return [];

    const pattern = `%${q}%`;
    const supabase = context.supabase;

    const [{ data: customers }, { data: bikes }] = await Promise.all([
      supabase
        .from("customers")
        .select("id")
        .or(
          `first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`,
        )
        .limit(20),
      supabase
        .from("motorcycles")
        .select("id")
        .or(
          `make.ilike.${pattern},model.ilike.${pattern},rego.ilike.${pattern},vin.ilike.${pattern}`,
        )
        .limit(20),
    ]);

    const customerIds = (customers ?? []).map((c) => c.id);
    const bikeIds = (bikes ?? []).map((b) => b.id);

    const bookingSelect =
      "id, scheduled_date, drop_off_time, status, service_type, customers(first_name,last_name), motorcycles(make,model,rego,year)";

    const queries: PromiseLike<{ data: any[] | null; error: any }>[] = [];
    if (customerIds.length)
      queries.push(
        supabase.from("bookings").select(bookingSelect).in("customer_id", customerIds).limit(20),
      );
    if (bikeIds.length)
      queries.push(
        supabase.from("bookings").select(bookingSelect).in("motorcycle_id", bikeIds).limit(20),
      );
    if (!queries.length) return [];

    const raw = await Promise.all(queries);
    for (const res of raw) {
      if (res.error) console.error("[globalSearch] query error:", res.error);
    }

    const bookings = dedupeById(raw.flatMap((r) => r.data ?? []));
    // Most recent first
    bookings.sort((a: any, b: any) =>
      String(b.scheduled_date ?? "").localeCompare(String(a.scheduled_date ?? "")),
    );

    return bookings.slice(0, 15).map((b: any) => {
      const cust = b.customers as { first_name?: string; last_name?: string } | null;
      const bike = b.motorcycles as
        | { make?: string; model?: string; rego?: string; year?: number }
        | null;
      const name = cust ? `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim() : "";
      const bikeLabel = bike
        ? `${bike.year ?? ""} ${bike.make ?? ""} ${bike.model ?? ""}`.trim()
        : "";
      const dateLabel = b.scheduled_date
        ? String(b.scheduled_date).split("-").reverse().join("/")
        : "";
      return {
        type: "booking" as const,
        id: b.id,
        title: [name, bikeLabel].filter(Boolean).join(" — ") || "Book-in",
        subtitle:
          [dateLabel, bike?.rego, b.service_type, b.status]
            .filter(Boolean)
            .join(" · ") || "",
        date: b.scheduled_date ?? null,
      };
    });
  });
