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
  const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
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
    let json: any;
    if (contentType.includes("application/json")) {
      json = await res.json();
    } else {
      // Some plans return XML — bail with a clear error rather than adding an XML parser.
      const txt = await res.text();
      try { json = JSON.parse(txt); } catch {
        throw new Error("Carjam returned a non-JSON response — enable JSON format on your API plan");
      }
    }

    // Carjam response shape varies by plan; unwrap common containers.
    const root = json?.vehicle ?? json?.data ?? json?.result ?? json;
    const basic = root?.basic ?? root?.identification ?? root;

    const yearRaw = pick(basic, ["year_of_manufacture", "year", "manufactureYear"]);
    const yearNum = yearRaw ? parseInt(String(yearRaw).slice(0, 4), 10) : undefined;
    const ccRaw = pick(basic, ["cc_rating", "cc", "engineCc", "engine_capacity"]);
    const ccNum = ccRaw ? parseInt(String(ccRaw).replace(/\D/g, ""), 10) || undefined : undefined;

    const inspections = root?.inspections ?? root?.wof ?? {};
    const wofExpiry = toISODate(pick(inspections, ["wof_expiry", "expiry_date", "next_inspection", "wof"]))
      ?? toISODate(pick(root, ["wof_expiry", "wof"]));
    const regoExpiry = toISODate(pick(root, ["licence_expiry", "rego_expiry", "expiry_date", "licence"]));

    return {
      rego: plate,
      vin: pick(basic, ["vin", "vin_number"]) as string | undefined,
      make: pick(basic, ["make"]) as string | undefined,
      model: pick(basic, ["model"]) as string | undefined,
      year: yearNum,
      color: pick(basic, ["main_colour", "colour", "color"]) as string | undefined,
      cc: ccNum,
      fuel: pick(basic, ["fuel_type", "fuel"]) as string | undefined,
      wof_expiry: wofExpiry,
      rego_expiry: regoExpiry,
    };
  });
