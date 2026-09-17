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

    const bookingFilter = [
      `id.ilike.${pattern}`,
      `scheduled_date.ilike.${pattern}`,
      customerIds.length ? `customer_id.in.(${customerIds.join(",")})` : null,
      bikeIds.length ? `motorcycle_id.in.(${bikeIds.join(",")})` : null,
    ]
      .filter(Boolean)
      .join(",");

    const jobFilter = [
      `id.ilike.${pattern}`,
      customerIds.length ? `customer_id.in.(${customerIds.join(",")})` : null,
      bikeIds.length ? `motorcycle_id.in.(${bikeIds.join(",")})` : null,
    ]
      .filter(Boolean)
      .join(",");

    const invoiceFilter = [
      `invoice_number.ilike.${pattern}`,
      customerIds.length ? `customer_id.in.(${customerIds.join(",")})` : null,
    ]
      .filter(Boolean)
      .join(",");

    const [{ data: bookings }, { data: jobs }, { data: invoices }] =
      await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id, scheduled_date, status, customers(first_name,last_name), motorcycles(make,model,rego)",
          )
          .or(bookingFilter)
          .limit(8),
        supabase
          .from("jobs")
          .select(
            "id, status, customers(first_name,last_name), motorcycles(make,model,rego)",
          )
          .or(jobFilter)
          .limit(8),
        supabase
          .from("invoices")
          .select("id, invoice_number, total_gst, customers(first_name,last_name)")
          .or(invoiceFilter)
          .limit(8),
      ]);

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

    if (bookings) {
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
    }

    if (jobs) {
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
          subtitle:
            [name, bike?.rego, j.status].filter(Boolean).join(" · ") || "",
          route: `/jobs/${j.id}`,
        });
      }
    }

    if (invoices) {
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
              typeof inv.total_gst === "number"
                ? `$${inv.total_gst.toFixed(2)}`
                : "",
            ]
              .filter(Boolean)
              .join(" · ") || "",
          route: `/invoices/${inv.id}`,
        });
      }
    }

    return results.slice(0, 25);
  });
