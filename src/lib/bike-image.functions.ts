import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.string().optional(),
  color: z.string().optional(),
});

export const generateBikeImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const yearStr = data.year ? `${data.year} ` : "";
    const colorStr = data.color ? `${data.color} ` : "";
    const prompt = `Studio product photograph of a ${yearStr}${colorStr}${data.make} ${data.model} motorcycle, three-quarter front view, clean neutral grey background, soft cinematic lighting, sharp focus, photorealistic, no text, no watermark`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-image-2",
        prompt,
        quality: "low",
        size: "1024x1024",
        n: 1,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("AI rate limit hit — try again in a moment");
      if (res.status === 402) throw new Error("AI credits exhausted — top up in Settings → Plans & credits");
      throw new Error(`Image generation failed: ${res.status} ${text}`);
    }

    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");
    return { b64_json: b64 };
  });