/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { completeGoogleCalendarConnection } from "@/lib/google-calendar.functions";

export const Route = createFileRoute("/oauth/google-calendar/return")({
  component: OAuthReturn,
});

function OAuthReturn() {
  const [message, setMessage] = useState("Finishing connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasOpener = (() => {
      try {
        return !!window.opener && window.opener !== window;
      } catch {
        return false;
      }
    })();

    const notifyOpenerAndClose = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: "google_calendar", code: code ?? null },
        window.location.origin,
      );
      window.close();
    };

    const success = params.get("success") === "true";
    const code = params.get("code");
    const noOfflineAccess = params.get("offline_access_allowed") === "false";

    if (!success) {
      setMessage(params.get("error") ?? "Google connection did not complete.");
      if (hasOpener) notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }

    // Full-page / new-tab flow: no opener to hand the code to, so finish here.
    if (!hasOpener) {
      (async () => {
        try {
          if (code) await completeGoogleCalendarConnection({ data: { code } });
          setMessage("Google Calendar connected. Taking you back…");
        } catch (err: any) {
          setMessage(err?.message ?? "Could not finish the Google connection.");
          return;
        }
        window.location.replace("/settings/google-calendar");
      })();
      return;
    }

    if (!code) {
      if (noOfflineAccess) {
        notifyOpenerAndClose("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("Google connection completed without an exchange code.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }
    notifyOpenerAndClose("appUserConnectorOAuthComplete", code);
  }, []);

  return <p className="p-6 text-sm text-muted-foreground">{message}</p>;
}
