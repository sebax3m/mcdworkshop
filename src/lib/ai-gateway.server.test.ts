import { test } from "node:test";
import { strict as assert } from "node:assert";
import { AI_MODELS, aiChat } from "./ai-gateway.server";

test("routine report formatting uses the selected Gemini 3.8 Flash", () => {
  assert.equal(AI_MODELS.formatting, "google/gemini-3.8-flash");
});
test("deep technical reasoning retains GPT Astra", () => {
  assert.equal(AI_MODELS.reasoning, "openai/gpt-6-astra");
});
test("Flash formatting transmits reference history and returns report text", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.LOVABLE_API_KEY;
  process.env.LOVABLE_API_KEY = "test-only";
  let body: any;
  let endpoint = "";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    endpoint = String(input);
    body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: " Spark plugs were replaced. " } }] }));
  }) as typeof fetch;
  try {
    const result = await aiChat({ model: AI_MODELS.formatting, system: "Preserve facts.", user: "Correct spelling.", history: [{ role: "user", content: "Previous draft: plugs replaced" }] });
    assert.equal(endpoint, "https://ai.gateway.lovable.dev/v1/chat/completions");
    assert.equal(body.model, "google/gemini-3.8-flash");
    assert.deepEqual(body.messages[1], { role: "user", content: "Previous draft: plugs replaced" });
    assert.equal(result, "Spark plugs were replaced.");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.LOVABLE_API_KEY;
    else process.env.LOVABLE_API_KEY = originalKey;
  }
});