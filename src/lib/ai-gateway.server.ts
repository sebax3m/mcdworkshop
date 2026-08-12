/**
 * Provider abstraction for MCD TECH.
 *
 * Every AI call in the workshop knowledge system goes through this module, so the
 * provider can be swapped later without touching the Garage Library, RAG, invoice
 * automation or job-brief code. Nothing here is imported by the browser.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export const AI_MODELS = {
  chat: "google/gemini-3.6-flash",
  embedding: "openai/text-embedding-3-small",
} as const;

export const EMBEDDING_DIMS = 1536;

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return key;
}

function gatewayError(status: number, body: string): Error {
  if (status === 429) return new Error("AI rate limit hit — try again in a moment");
  if (status === 402)
    return new Error("AI credits exhausted — top up in Settings → Plans & credits");
  return new Error(`AI request failed: ${status} ${body}`);
}

/** Chat completion. Used only as the LAST fallback in the retrieval cascade. */
export async function aiChat(opts: {
  system: string;
  user: string;
  model?: string;
  /** Prior turns of the same conversation, oldest first. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? AI_MODELS.chat,
      messages: [
        { role: "system", content: opts.system },
        ...(opts.history ?? []).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!res.ok) throw gatewayError(res.status, await res.text().catch(() => ""));
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Embeddings for document indexing and semantic retrieval. */
export async function aiEmbed(input: string[], model = AI_MODELS.embedding): Promise<number[][]> {
  if (input.length === 0) return [];
  const res = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) throw gatewayError(res.status, await res.text().catch(() => ""));
  const json = (await res.json()) as { data?: Array<{ embedding: number[]; index: number }> };
  const rows = json.data ?? [];
  return rows
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((r) => r.embedding);
}
