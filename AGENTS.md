<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Keep the Parts Orders pending count in the shared parts-orders query hook and invalidate it with parts mutations, so the main-menu badge stays consistent across pages.
- Parts orders for bookings AND insurance claims live in one table (booking_parts, with nullable booking_id + claim_id); insurance approval creates "needs_ordering" rows via DB trigger deduped by (claim_id, quote_item_id) — one record shown in every area.
- Remove staff accounts with irreversible Auth soft deletion, revoke their roles and hide deleted accounts from the user list; retain their Auth IDs and profiles so historical clock and job records are not cascade-deleted.
- Store valve diagram layout alongside per-job valve metadata and apply it to both worksheet renderers, so screen and print keep cylinder identities and measurements aligned.
- Time entries carry work_type ('service' | 'dyno'); Dyno analytics sum dyno entries and tuning invoice lines detected like the invoice's isDynoLine — keeps bench hours separate from service hours on mixed jobs.
- Quotes share the invoice editor and use status to select document labels; PDF export captures the print-preview sheet in the browser, keeping customer documents aligned without a second template.
- Use the shared Textarea autoSize option for booking and job instructions so loaded text and edits remain visible without manual resizing.
- Keep Harley/Indian defaults in service-kinds; platform selection is tracking-only except a first-time Power Vision licence split preserving the existing package total. Never reprice existing licence lines, clear billing on deselection, or charge retunes again.
- Calendar duplicate/another-motorcycle actions prefill the existing quick booking form, preserving customer IDs; copies create fresh bookings without copying job links, ordered parts, statuses, invitations or loan-bike allocations.
- Calendar notes use their existing note_time for position among book-ins; note dragging updates only note date/time and never reschedules bookings.
- Calendar, day view, dashboard and technician lists share calendar-booking-order helpers; only active bookings can be dragged or restamped, and stage-only boards never show positional insertion hints.
- Diagnostic bookings are auto-promoted to the service named in their notes/instructions by a bookings DB trigger (detect_service_from_text), which also renames the linked job — one rule for calendar, book-in and job card.
- Client polling uses useForeground to disable hidden/unfocused queries and resumes on focus; automatic clock-out recovers missed cutoffs on return so idle tabs do not query continuously.
- Workshop photo uploads store immutable paired .full and .thumb paths through photos.ts; grids use display URLs, zoom/PDF retain originals, deletion removes both, and legacy paths fall back without destructive migration.
- Routine report rewriting uses AI_MODELS.formatting through aiChat, separate from technical reasoning, so changing formatting models cannot downgrade specifications or diagnostics.
