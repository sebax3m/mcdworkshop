import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  startGoogleCalendarConnect,
  completeGoogleCalendarConnection,
  getGoogleCalendarStatus,
  disconnectGoogleCalendar,
} from "@/lib/google-calendar.functions";

export const Route = createFileRoute("/_authenticated/settings_/google-calendar")({
  component: GoogleCalendarSettings,
  head: () => ({
    meta: [
      { title: "Google Calendar | Motorcycle Doctors Workshop" },
      {
        name: "description",
        content: "Connect your Google account to send booking invitations to customers.",
      },
    ],
  }),
});

const CONNECTOR_ID = "google_calendar";

/**
 * Google blocks its sign-in page inside iframes (ERR_BLOCKED_BY_RESPONSE), so the
 * authorization URL must always be loaded in a real top-level window/tab — never
 * in the embedded preview frame. We open a genuine popup, and if the browser
 * blocks it we surface a normal link the user can click to open a new tab.
 */
function openTopLevel(url: string): Window | null {
  const win = window.open(url, "_blank", "popup=yes,width=600,height=720,noopener=no");
  if (win) {
    try {
      win.focus();
    } catch {
      /* ignore */
    }
    return win;
  }
  // Fallback: a user-gesture anchor click escapes sandboxed iframes in most browsers.
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "opener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  return null;
}

function waitForOAuthCompletion(): { promise: Promise<string | null>; cancel: () => void } {
  let cleanup = () => {};
  const promise = new Promise<string | null>((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.data?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") {
        resolve(typeof event.data?.code === "string" ? event.data.code : null);
      } else {
        reject(new Error("Google connection failed."));
      }
    };
    cleanup = () => window.removeEventListener("message", onMessage);
    window.addEventListener("message", onMessage);
  });
  return { promise, cancel: () => cleanup() };
}

function GoogleCalendarSettings() {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const status = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: () => getGoogleCalendarStatus(),
  });

  async function onConnect() {
    setConnecting(true);
    const waiter = waitForOAuthCompletion();
    try {
      const { authorizationUrl } = await startGoogleCalendarConnect();
      setAuthUrl(authorizationUrl);
      openTopLevel(authorizationUrl);
      const code = await waiter.promise;
      if (code) await completeGoogleCalendarConnection({ data: { code } });
      setAuthUrl(null);
      toast.success("Google Calendar connected");
      qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
    } catch (err: any) {
      waiter.cancel();
      toast.error(err?.message ?? "Could not connect Google Calendar");
    } finally {
      setConnecting(false);
    }
  }


  async function onDisconnect() {
    if (!confirm("Disconnect Google Calendar? Booking invitations will stop working.")) return;
    setDisconnecting(true);
    try {
      await disconnectGoogleCalendar();
      toast.success("Google Calendar disconnected");
      qc.invalidateQueries({ queryKey: ["google-calendar-status"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not disconnect");
    } finally {
      setDisconnecting(false);
    }
  }

  const connected = status.data?.connected;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <header>
        <div className="text-[0.625rem] uppercase tracking-[0.3em] text-muted-foreground">
          Settings
        </div>
        <h1 className="font-display text-3xl font-bold">Google Calendar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your Google account to send booking invitations to customers by email. Each
          staff member connects their own account.
        </p>
      </header>

      <section className="card-surface p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarCheck className="h-5 w-5" />
          </span>
          <div>
            <div className="font-display text-lg font-bold">
              {status.isLoading ? "Checking…" : connected ? "Connected" : "Not connected"}
            </div>
            {connected && status.data?.email && (
              <div className="text-sm text-muted-foreground">{status.data.email}</div>
            )}
          </div>
        </div>

        {connected ? (
          <button
            onClick={onDisconnect}
            disabled={disconnecting}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:border-foreground/30 disabled:opacity-60"
          >
            <Unlink className="h-4 w-4" />
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 rounded-lg red-surface px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <Link2 className="h-4 w-4" />
            {connecting ? "Connecting…" : "Connect Google Calendar"}
          </button>
        )}

        <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">
          Once connected, open any booking and press "Send Google invite" to email the customer a
          calendar invitation for their book-in date.
        </p>
      </section>
    </div>
  );
}
