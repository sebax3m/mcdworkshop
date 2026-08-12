import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * MCD TECH server functions.
 *
 * Retrieval order lives on the client (structured -> documents -> history -> AI);
 * these functions only do the things that must stay server-side: embedding
 * generation, indexing and the external-AI fallback.
 */

const ChunkInput = z.object({
  documentId: z.string().uuid(),
  chunks: z
    .array(
      z.object({
        content: z.string().min(1).max(6000),
        heading: z.string().nullable().optional(),
        page_from: z.number().int().nullable().optional(),
        page_to: z.number().int().nullable().optional(),
      }),
    )
    .min(1)
    .max(400),
  startIndex: z.number().int().min(0).default(0),
});

/** Admin-only: embed and store a batch of document sections. */
export const indexDocumentChunks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChunkInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: callerRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!(callerRoles ?? []).some((r) => r.role === "admin"))
      throw new Response("Forbidden", { status: 403 });

    const { aiEmbed } = await import("./ai-gateway.server");
    const vectors = await aiEmbed(data.chunks.map((c) => c.content));

    const rows = data.chunks.map((c, i) => ({
      document_id: data.documentId,
      chunk_index: data.startIndex + i,
      content: c.content,
      heading: c.heading ?? null,
      page_from: c.page_from ?? null,
      page_to: c.page_to ?? null,
      embedding: vectors[i] ? JSON.stringify(vectors[i]) : null,
    }));

    const { error } = await context.supabase
      .from("garage_document_chunks")
      .upsert(rows as never, { onConflict: "document_id,chunk_index" });
    if (error) throw new Error(error.message);
    return { indexed: rows.length };
  });

const SearchInput = z.object({
  question: z.string().min(2).max(500),
  make: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  modelId: z.string().uuid().nullable().optional(),
  limit: z.number().int().min(1).max(12).default(6),
});

/**
 * Semantic + keyword retrieval over indexed manual sections.
 * Documents are gated to the exact make/model AND year by the RPC, so a manual
 * for the wrong generation can never be returned.
 */
export const searchDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data, context }) => {
    let embedding: string | null = null;
    try {
      const { aiEmbed } = await import("./ai-gateway.server");
      const [vec] = await aiEmbed([data.question]);
      if (vec) embedding = JSON.stringify(vec);
    } catch {
      // Embedding unavailable -> keyword-only retrieval, never a hard failure.
    }

    const { data: rows, error } = await context.supabase.rpc("garage_search_chunks", {
      p_embedding: (embedding ?? undefined) as never,
      p_query: data.question,
      p_make: data.make ?? undefined,
      p_model: data.model ?? undefined,
      p_year: data.year ?? undefined,
      p_model_id: data.modelId ?? undefined,
      p_limit: data.limit,
    });
    if (error) throw new Error(error.message);
    return { sections: rows ?? [], semantic: embedding !== null };
  });

const AskInput = z.object({
  question: z.string().min(2).max(500),
  bike: z.string().max(200).nullable().optional(),
  context: z.string().max(8000).nullable().optional(),
  /** Prior turns of the same MCD TECH conversation, oldest first. */
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(20)
    .optional(),
});

/**
 * LAST-RESORT external AI. Only called when structured data, documents and
 * workshop history all failed to answer.
 */
export const askExternalAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AskInput.parse(d))
  .handler(async ({ data }) => {
    const { aiChat } = await import("./ai-gateway.server");
    const system = [
      "You are MCD TECH, a motorcycle workshop technical assistant for Motorcycle Doctors (New Zealand).",
      "The workshop has NO verified internal data for this question, so you are the last fallback.",
      data.bike
        ? `The whole conversation is about this motorcycle: ${data.bike}. Assume every question refers to it unless the technician clearly names another motorcycle. Never ask which motorcycle it is.`
        : "",
      "Follow the conversation thread: resolve pronouns and short follow-up questions using the earlier turns.",
      "Answer only if you are confident for the EXACT make/model/year given; otherwise say the specification must be confirmed against the manual.",
      "Never invent page numbers, document references or torque figures you are unsure of.",
      "Be extremely brief: short labelled lines or a small table. No preamble, no disclaimers longer than one line.",
      "Always finish with the single line: UNVERIFIED — confirm before use.",
    ]
      .filter(Boolean)
      .join(" ");
    const user = [
      data.bike ? `Motorcycle: ${data.bike}` : null,
      data.context ? `Workshop context:\n${data.context}` : null,
      `Question: ${data.question}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const answer = await aiChat({ system, user, history: data.history ?? [] });
    return { answer };
  });
