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

const etaSchema = z.object({ destination: z.string().min(3).max(300) });

export type TravelEta = { durationText: string; distanceText: string };

/** Drive time from the workshop to a transport address (Routes API). */
export const travelFromWorkshop = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => etaSchema.parse(data))
  .handler(async ({ data }): Promise<TravelEta> => {
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
        origin: { address: "94 Wairau Road, Wairau Valley, Auckland, New Zealand" },
        destination: { address: data.destination },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Routes computeRoutes failed [${response.status}]: ${body}`);
      throw new Error(`Travel time lookup failed [${response.status}]`);
    }

    const json = (await response.json()) as {
      routes?: Array<{ duration?: string; distanceMeters?: number }>;
    };
    const route = json.routes?.[0];
    if (!route) throw new Error("No route found");
    const seconds = Number(String(route.duration ?? "0s").replace("s", "")) || 0;
    const mins = Math.max(1, Math.round(seconds / 60));
    const km = (route.distanceMeters ?? 0) / 1000;
    return {
      durationText: mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`,
      distanceText: `${km.toFixed(1)} km`,
    };
  });
