import { supabase } from "@/integrations/supabase/client";

/** Append an immutable entry to the job audit timeline. Never throws. */
export async function logJobEvent(
  jobId: string,
  eventType: string,
  summary: string,
  detail: Record<string, unknown> = {},
  createdBy?: string | null,
) {
  try {
    await supabase.from("job_events").insert({
      job_id: jobId,
      event_type: eventType,
      summary,
      detail: detail as never,
      created_by: createdBy ?? null,
    });
  } catch {
    /* audit logging must never block the workflow */
  }
}
