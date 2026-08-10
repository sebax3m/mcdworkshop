/** Post Bike branches and helpers. Post bikes are tracked separately from
 * the normal workshop flow (they never auto-advance to awaiting inspection). */
export const BRANCHES = ["Beachlands", "Manukau", "Pukekohe"] as const;

export type Branch = (typeof BRANCHES)[number];

/** True when a booking's service type is the Post Bike service. */
export function isPostBike(serviceType?: string | null) {
  return (serviceType ?? "").toLowerCase().replace(/[\s_-]/g, "") === "postbike";
}
