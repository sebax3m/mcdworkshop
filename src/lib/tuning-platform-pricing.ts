import { HARLEY_INDIAN_LICENSE_PRICE, isHarleyMake } from "./service-kinds";

export const PV_LICENSE_PN = "PV-LICENSE";

type TunePart = {
  id: string;
  part_number?: string | null;
  name?: string | null;
  supplier?: string | null;
  retail?: number | null;
  quantity?: number | null;
  discount_pct?: number | null;
  on_invoice?: boolean | null;
};

/** Only a first-time Harley/Indian licence split may alter billing, never a platform switch/reset. */
export function powerVisionLicenceSplit(platform: string | null, make: string | null | undefined, parts: TunePart[], workText = "") {
  if (platform !== "powervision" || !isHarleyMake(make)) return null;
  if (parts.some((p) => p.part_number === PV_LICENSE_PN)) return null;
  const tunes = parts.filter((p) => p.on_invoice !== false && (
    /^(dyno(hd(stg1)?|stg2|retune)?|tuning)$/i.test(p.part_number ?? "") || /^dyno$|custom.*tun/i.test(p.name ?? "")
  ));
  // No price to preserve, or ambiguous charges: leave the invoice alone.
  if (tunes.length !== 1) return null;
  const dyno = tunes[0];
  if (!dyno) return null;
  const text = `${workText} ${dyno.part_number ?? ""} ${dyno.name ?? ""} ${dyno.supplier ?? ""}`;
  const multiplier = Number(dyno.quantity ?? 1) * (1 - Number(dyno.discount_pct ?? 0) / 100);
  const total = Number(dyno.retail ?? 0) * multiplier;
  if (/re-?tune/i.test(text) || !Number.isFinite(total) || total < 750 || multiplier <= 0) return null;
  return { dynoId: dyno.id, dynoRetail: (total - HARLEY_INDIAN_LICENSE_PRICE) / multiplier, licenceRetail: HARLEY_INDIAN_LICENSE_PRICE };
}