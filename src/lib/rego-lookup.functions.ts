/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  rego: z.string().trim().min(1).max(10),
});

export type RegoLookupResult = {
  rego: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  cc?: number;
  fuel?: string;
  wof_expiry?: string; // YYYY-MM-DD
  rego_expiry?: string; // YYYY-MM-DD
  _debugKeys?: string[];
  _debugSample?: string;
};

/** Try to coerce a Carjam date string (many formats) into YYYY-MM-DD. */
function toISODate(v: unknown): string | undefined {
  if (!v) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  // Already ISO
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${m}-${d}`;
  }
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  }
  return undefined;
}

/** Pull the first defined value from a list of possible keys. */
function pick(obj: any, keys: string[]): any {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

export const lookupRego = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<RegoLookupResult> => {
    const key = process.env.CARJAM_API_KEY;
    if (!key) throw new Error("Missing CARJAM_API_KEY — add it in Backend → Secrets");
    if (key.length !== 40) {
      throw new Error(
        `CARJAM_API_KEY looks malformed (expected 40 hex characters, got ${key.length}). Please check the secret in Backend → Secrets.`,
      );
    }
    const plate = data.rego.replace(/\s+/g, "").toUpperCase();

    const url = `https://api.carjam.co.nz/api/car/?plate=${encodeURIComponent(plate)}&key=${encodeURIComponent(key)}&format=json&info=basic,identification,other,inspections`;

    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) throw new Error("Carjam rejected the API key");
      if (res.status === 404) throw new Error(`No Carjam record for rego ${plate}`);
      throw new Error(`Carjam lookup failed: ${res.status} ${text.slice(0, 200)}`);
    }

    const contentType = res.headers.get("content-type") || "";
    const bodyText = await res.text();
    let json: any;
    if (contentType.includes("application/json") || bodyText.trimStart().startsWith("{")) {
      try {
        json = JSON.parse(bodyText);
      } catch {
        throw new Error("Carjam JSON parse failed");
      }
    } else {
      // Default Carjam response is XML — parse it.
      const { XMLParser } = await import("fast-xml-parser");
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        parseAttributeValue: true,
        parseTagValue: true,
        trimValues: true,
      });
      try {
        const parsed = parser.parse(bodyText);
        // Flatten: Carjam wraps everything under <vehicle> or <response><vehicle>
        json = parsed?.response ?? parsed?.vehicle ?? parsed;
      } catch (e: any) {
        throw new Error(`Carjam XML parse failed: ${e?.message ?? "unknown"}`);
      }
    }

    // Carjam error responses are returned with HTTP 200 and a code field.
    if (json?.code === -1 || json?.scode === "err-invalid-api-key") {
      throw new Error(
        "Carjam rejected the API key (err-invalid-api-key). Please check the secret in Backend → Secrets.",
      );
    }
    if (json?.code === -1 && json?.message) {
      throw new Error(`Carjam error: ${json.message}`);
    }

    // Carjam nests fields inconsistently — do a recursive deep search.
    // Also flatten any array of {key,value} / {name,value} / idh entries into a flat map.
    const flat: Record<string, any> = {};
    const norm = (s: string) => s.toLowerCase().replace(/[\s_\-]/g, "");
    function walk(node: any) {
      if (node == null) return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node !== "object") return;
      // key/value pair rows (Carjam <idh key="make">HONDA</idh> becomes { key:"make", "#text":"HONDA" })
      const k = node.key ?? node.name ?? node.field ?? node.label;
      const v = node.value ?? node["#text"] ?? node.text;
      if (
        typeof k === "string" &&
        v !== undefined &&
        (typeof v === "string" || typeof v === "number")
      ) {
        flat[norm(k)] = v;
      }
      for (const [ck, cv] of Object.entries(node)) {
        if (cv && typeof cv === "object") walk(cv);
        else if (typeof cv === "string" || typeof cv === "number") {
          if (!(ck in flat)) flat[norm(ck)] = cv;
        }
      }
    }
    walk(json);

    const get = (...keys: string[]): any => {
      for (const k of keys) {
        const v = flat[norm(k)];
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return undefined;
    };

    const yearRaw = get("year_of_manufacture", "year", "manufactureYear", "yearofmanufacture");
    const yearNum = yearRaw ? parseInt(String(yearRaw).slice(0, 4), 10) : undefined;
    const ccRaw = get("cc_rating", "cc", "engineCc", "engine_capacity", "ccrating");
    const ccNum = ccRaw ? parseInt(String(ccRaw).replace(/\D/g, ""), 10) || undefined : undefined;

    const result: RegoLookupResult = {
      rego: plate,
      vin: get("vin", "vin_number", "vinnumber", "chassis"),
      make: get("make", "manufacturer"),
      model: get("model", "modelname"),
      year: yearNum,
      color: get("main_colour", "maincolour", "colour", "color"),
      cc: ccNum,
      fuel: get("fuel_type", "fueltype", "fuel"),
      wof_expiry: toISODate(
        get("wof_expiry", "wofexpiry", "next_inspection", "nextinspection", "wof"),
      ),
      rego_expiry: toISODate(
        get("licence_expiry", "licenceexpiry", "rego_expiry", "regoexpiry", "expirydate"),
      ),
    };

    if (!result.make && !result.model) {
      result._debugKeys = Object.keys(flat).slice(0, 80);
      result._debugSample = JSON.stringify(flat).slice(0, 2000);
    }

    return result;
  });
