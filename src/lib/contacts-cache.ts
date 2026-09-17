import type { QueryClient } from "@tanstack/react-query";

/**
 * Every cache that shows customers or motorcycles. Whenever a customer or a
 * bike is created/edited anywhere (book-in, calendar quick add, invoice,
 * insurance claim, contacts page), refresh all of them so the new contact
 * shows up immediately in every search list.
 */
const CONTACT_KEYS = [
  "customers",
  "customers-list",
  "customers-bikes",
  "customers-options",
  "customer",
  "customer-bikes",
  "customer-refs",
  "bk-customers",
  "bk-bikes",
  "bk-all-bikes",
  "quick-customers",
  "quick-bikes",
  "ins-customers",
  "ins-bikes",
  "new-inv-customers",
  "new-inv-bikes",
  "motorcycles",
  "bikes-list",
  "edit-bikes",
  "booking-customer-bikes",
  "unlinked-motorcycles",
  "loan-bike-customer-search",
];

export async function refreshContacts(qc: QueryClient) {
  await Promise.all(
    CONTACT_KEYS.map((key) => qc.invalidateQueries({ queryKey: [key] })),
  );
}
