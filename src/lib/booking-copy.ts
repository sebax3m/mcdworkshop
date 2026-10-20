type BookingSource = {
  customer_id: string;
  motorcycle_id?: string | null;
  service_type?: string | null;
  service_type_other?: string | null;
  estimated_hours?: number | null;
  notes?: string | null;
  instructions?: string | null;
};

/** Copy editable booking details, not job/order/status or loan allocations. */
export function bookingCopySeed(source: BookingSource, anotherBike: boolean) {
  return {
    customerId: source.customer_id,
    bikeId: anotherBike ? null : source.motorcycle_id ?? null,
    service: source.service_type ?? "Diagnostic",
    serviceOther: source.service_type_other ?? "",
    estimatedHours: String(source.estimated_hours ?? 1),
    notes: anotherBike ? "" : [source.notes, source.instructions].filter((v, i, all) => v && all.indexOf(v) === i).join("\n"),
  };
}