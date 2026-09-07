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

export const startGoogleCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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

    const connectionAPIKey = await getConnectionKeyForUser(context.userId, CONNECTOR_ID);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey: clientKey,
      returnUrl,
      connectionAPIKey: connectionAPIKey ?? undefined,
      credentialsConfiguration: { scopes: SCOPES },
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

export const sendBookingCalendarInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) =>
    z.object({ bookingId: z.string() }).parse(input),
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
        "id, scheduled_date, drop_off_time, scheduled_end_time, estimated_hours, service_type, service_type_other, notes, customers(first_name,last_name,email), motorcycles(year,make,model,rego)",
      )
      .eq("id", data.bookingId)
      .single();
    if (error || !b) throw new Error("Booking not found");

    const customer = (b as any).customers;
    const email: string | null = customer?.email ?? null;
    if (!email) throw new Error("This customer has no email address on file.");

    const startTime = (b.drop_off_time || "09:00").slice(0, 5);
    const startIso = `${b.scheduled_date}T${startTime}:00`;
    let endIso: string;
    if (b.scheduled_end_time) {
      endIso = `${b.scheduled_date}T${String(b.scheduled_end_time).slice(0, 5)}:00`;
    } else {
      const hours = Number(b.estimated_hours) || 1;
      const end = new Date(`${startIso}+12:00`);
      end.setHours(end.getHours() + hours);
      const pad = (n: number) => String(n).padStart(2, "0");
      endIso = `${b.scheduled_date}T${pad(end.getHours())}:${pad(end.getMinutes())}:00`;
    }

    const bike = (b as any).motorcycles;
    const bikeLabel = bike
      ? `${bike.year ?? ""} ${bike.make ?? ""} ${bike.model ?? ""}`.trim() +
        (bike.rego ? ` (${bike.rego})` : "")
      : null;
    const serviceLabel =
      b.service_type === "Other" && b.service_type_other ? b.service_type_other : b.service_type;
    const customerName =
      [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer";

    const event = {
      summary: `Motorcycle Doctors — ${serviceLabel} · ${customerName}`,
      description: [
        bikeLabel ? `Bike: ${bikeLabel}` : null,
        b.notes ? `Notes: ${b.notes}` : null,
        "",
        "Booked with Motorcycle Doctors.",
      ]
        .filter((l) => l !== null)
        .join("\n"),
      start: { dateTime: startIso, timeZone: TZ },
      end: { dateTime: endIso, timeZone: TZ },
      attendees: [{ email, displayName: customerName }],
      reminders: { useDefault: true },
    };

    const res = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CONNECTOR_ID,
      path: "/calendar/v3/calendars/primary/events?sendUpdates=all",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Google Calendar event create failed [${res.status}]: ${body}`);
      throw new Error(`Google Calendar request failed [${res.status}]: ${body}`);
    }

    return { ok: true, email };
  });
