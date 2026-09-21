# ChatGPT-style Fix Wording

## Goal
Replace the one-click rewrite with a temporary conversation for the current Work Performed entry. The technician can ask for revisions, review each response, then accept the final wording or cancel without changing the entry.

## Experience
- Open a focused Fix Wording dialog from either a new or existing Work Performed entry.
- Start with the technician's current details and generate the first polished version automatically.
- Show technician requests and AI responses as a familiar chat transcript.
- Keep the latest AI version as the candidate wording.
- Let the technician request follow-ups such as “make it shorter”, “separate the diagnosis”, or “make it easier for the customer”.
- **Use wording** copies the latest AI response into Details; **Cancel** leaves Details unchanged.
- Keep the conversation only while the dialog is open; do not save chat history.

## Technical details
- Use the installed AI Elements conversation, message, prompt input, and shimmer components.
- Extend the protected wording server function to accept the original technician note plus temporary conversation turns while preserving the existing no-invention rules.
- Keep all model calls server-side and preserve MCD TECH access controls.
- Keep assistant messages unboxed and user requests in a high-contrast semantic bubble.
- Preserve title, blank lines, and paragraph formatting when accepted.
- Verify the new dialog on mobile and desktop, then check the project build and preview errors.
