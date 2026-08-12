import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const WORKSHOP_ADDRESS = "94 Wairau Road, Wairau Valley, Auckland, New Zealand";

const inputSchema = z.object({ query: z.string().min(3).max(200) });
const etaInputSchema = z.object({ destination: z.string().min(3).max(300) });

export type AddressSuggestion = { placeId: string; address: string };

export type EtaResult = {
  durationSeconds: number;
  distanceMeters: number;
  formattedDuration: string;
  formattedDistance: string;
};

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

/** ETA from the workshop (94 Wairau Road) to a customer address via the Routes API. */
export const getEta = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => etaInputSchema.parse(data))
  .handler(async ({ data }): Promise<EtaResult | null> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!lovableKey || !mapsKey) throw new Error("Google Maps is not connected");

    const response = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { address: WORKSHOP_ADDRESS },
        destination: { address: data.destination },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Routes ETA failed [${response.status}]: ${body}`);
      if (response.status === 403) {
        throw new Error("Google Maps request denied (403). Check the API key restrictions.");
      }
      return null;
    }

    const json = (await response.json()) as {
      routes?: Array<{ duration?: string; distanceMeters?: number }>;
    };
    const route = json.routes?.[0];
    if (!route?.duration) return null;

    const durationSeconds = parseInt(route.duration.replace("s", ""), 10) || 0;
    const distanceMeters = route.distanceMeters ?? 0;

    return {
      durationSeconds,
      distanceMeters,
      formattedDuration: formatDuration(durationSeconds),
      formattedDistance: formatDistance(distanceMeters),
    };
  });

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}
