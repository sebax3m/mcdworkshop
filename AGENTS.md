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
