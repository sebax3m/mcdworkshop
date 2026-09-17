import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({ query: z.string().max(100) });

type SearchResult = {
  type: "customer" | "bike" | "booking" | "job" | "invoice";
  id: string;
  title: string;
  subtitle: string;
  route: string;
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
  .handler(async ({ data, context }): Promise<SearchResult[]> => {
    const q = data.query.trim();
    if (!q || q.length < 2) return [];

    const pattern = `%${q}%`;
    const supabase = context.supabase;
    const results: SearchResult[] = [];

    const [{ data: customers }, { data: bikes }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, first_name, last_name, phone, email")
        .or(
          `first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`,
        )
        .limit(8),
      supabase
        .from("motorcycles")
        .select("id, make, model, year, rego, vin")
        .or(
          `make.ilike.${pattern},model.ilike.${pattern},rego.ilike.${pattern},vin.ilike.${pattern}`,
        )
        .limit(8),
    ]);

    const customerIds = (customers ?? []).map((c) => c.id);
    const bikeIds = (bikes ?? []).map((b) => b.id);

    const bookingSelect =
      "id, scheduled_date, status, customers(first_name,last_name), motorcycles(make,model,rego)";
    const [bookingsByText, bookingsByCustomer, bookingsByBike] =
      await Promise.all([
        supabase
          .from("bookings")
          .select(bookingSelect)
          .or(`id.ilike.${pattern},scheduled_date.ilike.${pattern}`)
          .limit(8),
        customerIds.length
          ? supabase
              .from("bookings")
              .select(bookingSelect)
              .in("customer_id", customerIds)
              .limit(8)
          : Promise.resolve({ data: [], error: null } as any),
        bikeIds.length
          ? supabase
              .from("bookings")
              .select(bookingSelect)
              .in("motorcycle_id", bikeIds)
              .limit(8)
          : Promise.resolve({ data: [], error: null } as any),
      ]);

    const jobSelect =
      "id, status, customers(first_name,last_name), motorcycles(make,model,rego)";
    const [jobsByText, jobsByCustomer, jobsByBike] = await Promise.all([
      supabase
        .from("jobs")
        .select(jobSelect)
        .ilike("id", pattern)
        .limit(8),
      customerIds.length
        ? supabase
            .from("jobs")
            .select(jobSelect)
            .in("customer_id", customerIds)
            .limit(8)
        : Promise.resolve({ data: [], error: null } as any),
      bikeIds.length
        ? supabase
            .from("jobs")
            .select(jobSelect)
            .in("motorcycle_id", bikeIds)
            .limit(8)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    const invoiceSelect =
      "id, invoice_number, total, customers(first_name,last_name)";
    const [invoicesByText, invoicesByCustomer] = await Promise.all([
      supabase
        .from("invoices")
        .select(invoiceSelect)
        .ilike("invoice_number", pattern)
        .limit(8),
      customerIds.length
        ? supabase
            .from("invoices")
            .select(invoiceSelect)
            .in("customer_id", customerIds)
            .limit(8)
        : Promise.resolve({ data: [] }),
    ]);

    const bookingsRaw = [
      bookingsByText,
      bookingsByCustomer,
      bookingsByBike,
    ] as const;
    const jobsRaw = [jobsByText, jobsByCustomer, jobsByBike] as const;
    const invoicesRaw = [invoicesByText, invoicesByCustomer] as const;
    for (const res of [...bookingsRaw, ...jobsRaw, ...invoicesRaw]) {
      if (res.error) {
        console.error("[globalSearch] query error:", res.error);
      }
    }

    const bookings = dedupeById([
      ...(bookingsByText.data ?? []),
      ...(bookingsByCustomer.data ?? []),
      ...(bookingsByBike.data ?? []),
    ]);
    const jobs = dedupeById([
      ...(jobsByText.data ?? []),
      ...(jobsByCustomer.data ?? []),
      ...(jobsByBike.data ?? []),
    ]);
    const invoices = dedupeById([
      ...(invoicesByText.data ?? []),
      ...(invoicesByCustomer.data ?? []),
    ]);
    console.log("[globalSearch] counts customers=", (customers ?? []).length, "bikes=", (bikes ?? []).length, "bookings=", bookings.length, "jobs=", jobs.length, "invoices=", invoices.length);

    if (customers) {
      for (const c of customers) {
        const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
        results.push({
          type: "customer",
          id: c.id,
          title: name || "Customer",
          subtitle: [c.phone, c.email].filter(Boolean).join(" · ") || "",
          route: `/customers/${c.id}`,
        });
      }
    }

    if (bikes) {
      for (const b of bikes) {
        results.push({
          type: "bike",
          id: b.id,
          title:
            `${b.year ?? ""} ${b.make ?? ""} ${b.model ?? ""}`.trim() || "Bike",
          subtitle: [b.rego, b.vin].filter(Boolean).join(" · ") || "",
          route: `/motorcycles/${b.id}`,
        });
      }
    }

    for (const b of bookings as any[]) {
      const cust = b.customers as {
        first_name?: string;
        last_name?: string;
      } | null;
      const bike = b.motorcycles as {
        make?: string;
        model?: string;
        rego?: string;
      } | null;
      const name = cust
        ? `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim()
        : "";
      results.push({
        type: "booking",
        id: b.id,
        title: `Book-in ${b.scheduled_date ?? ""}`,
        subtitle:
          [name, bike?.rego, b.status].filter(Boolean).join(" · ") || "",
        route: `/bookings/${b.id}`,
      });
    }

    for (const j of jobs as any[]) {
      const cust = j.customers as {
        first_name?: string;
        last_name?: string;
      } | null;
      const bike = j.motorcycles as {
        make?: string;
        model?: string;
        rego?: string;
      } | null;
      const name = cust
        ? `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim()
        : "";
      results.push({
        type: "job",
        id: j.id,
        title: `Job #${j.id.slice(0, 8)}`,
        subtitle: [name, bike?.rego, j.status].filter(Boolean).join(" · ") || "",
        route: `/jobs/${j.id}`,
      });
    }

    for (const inv of invoices as any[]) {
      const cust = inv.customers as {
        first_name?: string;
        last_name?: string;
      } | null;
      const name = cust
        ? `${cust.first_name ?? ""} ${cust.last_name ?? ""}`.trim()
        : "";
      results.push({
        type: "invoice",
        id: inv.id,
        title: inv.invoice_number || `Invoice ${inv.id.slice(0, 8)}`,
        subtitle:
          [
            name,
            typeof inv.total === "number" ? `$${inv.total.toFixed(2)}` : "",
          ]
            .filter(Boolean)
            .join(" · ") || "",
        route: `/invoices/${inv.id}`,
      });
    }

    return results.slice(0, 25);
  });
