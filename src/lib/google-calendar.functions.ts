import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  authorizeAppUserOAuth,
  callAsAppUser,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  saveConnectionKeyForUser,
  getConnectionKeyForUser,
  deleteConnectionKeyForUser,
} from "@/server/appUserConnections.server";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_calendar";
const CLIENT_KEY_ENV = "GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY";

const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.events",
];

const RECONNECT_MESSAGE =
  "Your Google Calendar connection needs updated event permissions. Go to Settings → Google Calendar and connect it again, then allow calendar event access.";

export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { forceFresh?: boolean } | undefined) =>
    z.object({ forceFresh: z.boolean().optional() }).optional().parse(input),
  )
  .handler(async ({ data, context }) => {
    const clientKey = process.env[CLIENT_KEY_ENV];
    if (!clientKey) throw new Error(`${CLIENT_KEY_ENV} is not set`);
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/google-calendar/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    let connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);

    // A token granted before calendar.events was added cannot gain that scope by
    // merely reusing its connector key. Revoke it and start a first-time consent
    // so Google issues a replacement refresh/access token with the requested scope.
    if (data?.forceFresh && connectionAPIKey) {
      await disconnectAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey,
        connectorId: CONNECTOR_ID,
      });
      await deleteConnectionKeyForUser(context.userId, CONNECTOR_ID);
      connectionAPIKey = null;
    }

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: connectionAPIKey ?? undefined,
      credentialsConfiguration: {
        scopes: SCOPES,
        // These are passed while the authorization URL is generated, not only
        // configured on the Google OAuth client.
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: false,
      },
    });
    return { authorizationUrl };
  });

export const completeGoogleCalendarConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => z.object({ code: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== CONNECTOR_ID) {
      throw new Error("OAuth completion returned the wrong connector");
    }
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true };
  });

export const getGoogleCalendarStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!key) return { connected: false as const, email: null as string | null };
    try {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
        path: "/calendar/v3/users/me/calendarList/primary",
      });
      if (!res.ok) return { connected: true as const, email: null as string | null };
      const cal = (await res.json()) as { id?: string };
      return { connected: true as const, email: cal.id ?? null };
    } catch {
      return { connected: true as const, email: null as string | null };
    }
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (key) {
      await disconnectAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: key,
        connectorId: CONNECTOR_ID,
      });
    }
    await deleteConnectionKeyForUser(context.userId, CONNECTOR_ID);
    return { ok: true };
  });

const TZ = "Pacific/Auckland";

function addHours(dateStr: string, time: string, hours: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dateStr}T${pad(Math.min(23, Math.floor(total / 60)))}:${pad(total % 60)}:00`;
}

/**
 * Creates the customer's Google Calendar invitation for a booking, or updates
 * the existing event when one was already created (no duplicates).
 */
export const syncBookingCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { bookingId: string; email?: string | null; includeEnd?: boolean }) =>
      z
        .object({
          bookingId: z.string(),
          email: z.string().email().nullish(),
          includeEnd: z.boolean().optional(),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (!connectionAPIKey) {
      throw new Error(
        "Google Calendar is not connected. Connect it in Settings → Google Calendar first.",
      );
    }

    const { data: b, error } = await context.supabase
      .from("bookings")
      .select(
        "id, scheduled_date, drop_off_time, scheduled_end_time, estimated_hours, service_type, service_type_other, instructions, google_event_id, google_invite_email, google_include_end, customers(first_name,last_name,email,phone), motorcycles(year,make,model,rego)",
      )
      .eq("id", data.bookingId)
      .single();
    if (error || !b) throw new Error("Booking not found");

    const row = b as any;
    const customer = row.customers;
    const email: string | null = data.email ?? row.google_invite_email ?? customer?.email ?? null;
    if (!email) throw new Error("This customer has no email address on file.");

    const includeEnd = data.includeEnd ?? row.google_include_end ?? false;

    const startTime = (row.drop_off_time || "09:00").slice(0, 5);
    const startIso = `${row.scheduled_date}T${startTime}:00`;
    const endIso =
      includeEnd && row.scheduled_end_time
        ? `${row.scheduled_date}T${String(row.scheduled_end_time).slice(0, 5)}:00`
        : addHours(row.scheduled_date, startTime, Number(row.estimated_hours) || 1);

    const bike = row.motorcycles;
    const bikeLabel = bike
      ? `${bike.year ?? ""} ${bike.make ?? ""} ${bike.model ?? ""}`.trim() +
        (bike.rego ? ` (${bike.rego})` : "")
      : null;
    const bikeShort = bike ? `${bike.make ?? ""} ${bike.model ?? ""}`.trim() : "Motorcycle";
    const serviceLabel =
      row.service_type === "Other" && row.service_type_other
        ? row.service_type_other
        : row.service_type;
    const customerName =
      [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer";

    const pickupLine =
      includeEnd && row.scheduled_end_time
        ? `Expected completion / pick-up: ${String(row.scheduled_end_time).slice(0, 5)}`
        : null;

    const event = {
      summary: `Motorcycle Doctors – ${bikeShort} – ${customerName}`,
      description: [
        `This is your Motorcycle Doctors booking. Please drop your bike off at ${startTime} on this date.`,
        "",
        `Customer: ${customerName}`,
        customer?.phone ? `Phone: ${customer.phone}` : null,
        bikeLabel ? `Motorcycle: ${bikeLabel}` : null,
        `Booking reason: ${serviceLabel}`,
        row.instructions ? `Notes: ${row.instructions}` : null,
        pickupLine,
      ]
        .filter((l) => l !== null)
        .join("\n"),
      start: { dateTime: startIso, timeZone: TZ },
      end: { dateTime: endIso, timeZone: TZ },
      attendees: [{ email, displayName: customerName }],
      reminders: { useDefault: true },
    };

    const existingId: string | null = row.google_event_id ?? null;
    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CONNECTOR_ID,
      path: existingId
        ? `/calendar/v3/calendars/primary/events/${encodeURIComponent(existingId)}?sendUpdates=all`
        : "/calendar/v3/calendars/primary/events?sendUpdates=all",
      init: {
        method: existingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Google Calendar event sync failed [${res.status}]: ${body}`);
      const scopeProblem =
        res.status === 401 ||
        (res.status === 403 &&
          /insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions|PERMISSION_DENIED/i.test(
            body,
          ));
      if (scopeProblem) {
        // Do not leave a stale key looking connected. Removing it makes the
        // Settings screen offer a clean first-time authorization that requests
        // calendar.events and replaces the old Google refresh/access token.
        try {
          await disconnectAppUser({
            gatewayBaseUrl: GATEWAY_BASE_URL,
            connectionAPIKey,
            connectorId: CONNECTOR_ID,
          });
        } catch (disconnectError) {
          console.warn("Could not revoke the stale Google Calendar connection", disconnectError);
        }
        await deleteConnectionKeyForUser(context.userId, CONNECTOR_ID);
        return {
          ok: false as const,
          requiresReconnect: true as const,
          message: RECONNECT_MESSAGE,
        };
      }
      throw new Error(`Google Calendar request failed [${res.status}]: ${body}`);
    }

    const created = (await res.json()) as { id?: string };
    await context.supabase
      .from("bookings")
      .update({
        google_event_id: created.id ?? existingId,
        google_event_owner: context.userId,
        google_invite_email: email,
        google_include_end: includeEnd,
      } as any)
      .eq("id", row.id);

    return {
      ok: true as const,
      email,
      updated: !!existingId,
      requiresReconnect: false as const,
    };
  });

/** Backwards-compatible alias used by the booking page button. */
export const sendBookingCalendarInvite = syncBookingCalendarEvent;

export const cancelBookingCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) =>
    z.object({ bookingId: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: b } = await context.supabase
      .from("bookings")
      .select("id, google_event_id")
      .eq("id", data.bookingId)
      .single();
    const eventId = (b as any)?.google_event_id;
    if (!eventId) return { ok: true, cancelled: false };

    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    if (connectionAPIKey) {
      const res = await callAsAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey,
        connectorId: CONNECTOR_ID,
        path: `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
        init: { method: "DELETE" },
      });
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        const body = await res.text();
        console.error(`Google Calendar event delete failed [${res.status}]: ${body}`);
        throw new Error(`Google Calendar request failed [${res.status}]: ${body}`);
      }
    }

    await context.supabase
      .from("bookings")
      .update({ google_event_id: null } as any)
      .eq("id", data.bookingId);
    return { ok: true, cancelled: true };
  });


/**
 * Reports whether a booking already has a Google invitation that should be
 * refreshed after a reschedule.
 */
export const bookingNeedsCalendarResync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) =>
    z.object({ bookingId: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: b } = await context.supabase
      .from("bookings")
      .select("google_event_id")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (!(b as any)?.google_event_id) return { ok: true, synced: false };
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);
    return { ok: true, synced: !!connectionAPIKey };
  });
