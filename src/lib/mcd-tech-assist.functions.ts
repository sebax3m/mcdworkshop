import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * MCD TECH language-assistance server functions.
 *
 * These are the ONLY places external AI is used for writing (never for
 * technical values): cleaning up rough technician notes, explaining a technical
 * note to a customer, and sorting inspection findings into urgency buckets.
 *
 * Every handler re-checks role + workshop AI settings server-side, so toggling
 * a setting off actually blocks the request rather than only hiding a button.
 */

type Guard = { customerText?: boolean };

async function guard(
  context: { supabase: any; userId: string },
  opts: Guard = {},
): Promise<void> {
  const [{ data: roles }, { data: settings }] = await Promise.all([
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    context.supabase.from("mcd_tech_settings").select("*").maybeSingle(),
  ]);
  const list = (roles ?? []).map((r: { role: string }) => r.role);
  const isAdmin = list.includes("admin");
  const isStaff = isAdmin || list.includes("technician");
  if (!isStaff) throw new Response("Forbidden", { status: 403 });

  const s = settings ?? {};
  if (s.ai_enabled === false) throw new Response("MCD TECH is disabled", { status: 403 });
  if (!isAdmin && s.allow_technician_access === false)
    throw new Response("Forbidden", { status: 403 });
  if (opts.customerText && s.allow_customer_reports === false)
    throw new Response("Customer text generation is disabled", { status: 403 });
}

/* ------------------------------------------------------------------ */

const NoteInput = z.object({ text: z.string().min(3).max(4000) });

/** Rewrite rough shorthand into workshop wording. Original text is never touched. */
export const cleanTechnicianNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => NoteInput.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context as never);
    const { aiChat } = await import("./ai-gateway.server");
    const suggestion = await aiChat({
      system: [
        "You are MCD TECH, rewriting a motorcycle technician's rough shorthand into clear workshop wording.",
        "Rules: keep every fact, never add findings, measurements, parts or prices that are not in the input.",
        "Use short professional sentences in New Zealand English. Output only the rewritten note, no preamble.",
      ].join(" "),
      user: data.text,
    });
    return { suggestion, original: data.text };
  });

/* ------------------------------------------------------------------ */

const ExplainInput = z.object({
  note: z.string().min(3).max(2000),
  bike: z.string().max(200).nullable().optional(),
});

/** Customer-facing explanation of a technical note. Requires user approval before saving. */
export const explainToCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExplainInput.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context as never, { customerText: true });
    const { aiChat } = await import("./ai-gateway.server");
    const suggestion = await aiChat({
      system: [
        "You are writing for Motorcycle Doctors (New Zealand) to explain a workshop finding to a motorcycle owner.",
        "Plain, calm, non-alarmist language. 2–4 sentences. No prices, no parts numbers, no invented symptoms.",
        "Explain what the component does, what was found, and what is recommended. Output only the explanation.",
      ].join(" "),
      user: [data.bike ? `Motorcycle: ${data.bike}` : null, `Technical note: ${data.note}`]
        .filter(Boolean)
        .join("\n"),
    });
    return { suggestion };
  });

/* ------------------------------------------------------------------ */

const TriageInput = z.object({
  findings: z.array(z.object({ id: z.string(), title: z.string().max(300), detail: z.string().max(600).nullable() })).min(1).max(30),
});

/** Suggest CRITICAL / RECOMMENDED / MONITOR buckets. The technician decides. */
export const triageFindings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TriageInput.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context as never);
    const { aiChat } = await import("./ai-gateway.server");
    const raw = await aiChat({
      system: [
        "You triage motorcycle workshop inspection findings into urgency buckets.",
        "Allowed buckets: CRITICAL, RECOMMENDED, MONITOR. Anything affecting rider safety now is CRITICAL.",
        "Return ONLY lines of the form: <id>|<BUCKET>|<max 12 word reason>. No other text.",
      ].join(" "),
      user: data.findings.map((f) => `${f.id}: ${f.title}${f.detail ? ` — ${f.detail}` : ""}`).join("\n"),
    });
    const allowed = new Set(["CRITICAL", "RECOMMENDED", "MONITOR"]);
    const byId = new Map(data.findings.map((f) => [f.id, f]));
    const results = raw
      .split("\n")
      .map((line) => line.split("|").map((p) => p.trim()))
      .filter((p) => p.length >= 2 && byId.has(p[0]!) && allowed.has((p[1] ?? "").toUpperCase()))
      .map((p) => ({ id: p[0]!, bucket: (p[1] as string).toUpperCase(), reason: p[2] ?? "" }));
    return { results };
  });
