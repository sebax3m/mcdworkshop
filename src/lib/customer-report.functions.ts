import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  facts: z.record(z.string(), z.unknown()),
});

/**
 * Rewrites recorded job facts into a customer-facing work report.
 * The model may only rephrase what it is given — it must not invent work.
 */
export const generateCustomerReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const system = [
      "You write customer-facing workshop reports for Motorcycle Doctors (New Zealand).",
      "You are given STRUCTURED JOB DATA as JSON. Use ONLY that data.",
      "Never invent work, parts, measurements, prices or recommendations that are not present.",
      "If a section has no data, omit the section entirely.",
      "Rewrite technical shorthand into clear, plain, polite customer language. NZ English.",
      "Output plain text only (no markdown), using these uppercase section headings in this order when data exists:",
      "WORK COMPLETED, INSPECTION FINDINGS, ADDITIONAL WORK COMPLETED, DECLINED / DEFERRED WORK, RECOMMENDATIONS, TECHNICIAN NOTES.",
      "Use '• ' bullets. Keep each bullet to one short sentence.",
    ].join(" ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(data.facts) },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI rate limit hit — try again in a moment");
      if (res.status === 402)
        throw new Error("AI credits exhausted — top up in Settings → Plans & credits");
      throw new Error(`Report generation failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const report = json.choices?.[0]?.message?.content?.trim();
    if (!report) throw new Error("No report returned");
    return { report };
  });
