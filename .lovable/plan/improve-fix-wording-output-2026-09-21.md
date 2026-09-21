# Improve Fix Wording output

## Goal
Make **Fix Wording** turn rough technician notes into a polished workshop report matching the supplied example.

## Changes
- Update the writing instructions to produce a concise diagnostic title followed by clear, separated paragraphs.
- Preserve every original fact while improving grammar, sequencing, and professional tone.
- Keep unrelated work separated and avoid inventing findings, measurements, parts, prices, or conclusions.
- Verify the existing button still uses the updated writer and the app builds successfully.

## Technical details
- Keep the existing authenticated server function and Lovable AI integration.
- Change only the prompt used by the existing **Fix Wording** action; no data or workflow changes.
