import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const inputSchema = z.object({ query: z.string().min(3).max(200) });

export type AddressSuggestion = { placeId: string; address: string };

/** Auckland-biased address autocomplete through the Google Maps gateway. */
export const suggestAddresses = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<AddressSuggestion[]> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovableKey || !mapsKey) throw new Error("Google Maps is not connected");

    const response = await fetch(`${GATEWAY_URL}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: data.query,
        includedRegionCodes: ["nz"],
        locationBias: {
          circle: {
            center: { latitude: -36.8485, longitude: 174.7633 },
            radius: 50000,
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Maps autocomplete failed [${response.status}]: ${body}`);
      if (response.status === 403) {
        throw new Error("Google Maps request denied (403). Check the API key restrictions.");
      }
      throw new Error(`Address lookup failed [${response.status}]`);
    }

    const json = (await response.json()) as {
      suggestions?: Array<{
        placePrediction?: { placeId?: string; text?: { text?: string } };
      }>;
    };

    return (json.suggestions ?? [])
      .map((s) => ({
        placeId: s.placePrediction?.placeId ?? "",
        address: s.placePrediction?.text?.text ?? "",
      }))
      .filter((s) => s.address);
  });
