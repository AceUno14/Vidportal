# Phase 3 Slice 3: Private review and decisions

Status: complete.

VidPortal now turns a verified R2 video into a private review version without requiring a paid streaming service. The server authorizes each playback request and returns a short-lived presigned URL; the bucket remains private.

Clients can play the current cut, leave timestamped notes, request changes, or approve the cut. Decisions are recorded in PostgreSQL with the acting membership and an activity record. Approval advances the project to `FINAL_DELIVERY`; a change request advances it to `REVISIONS`.

The interface keeps the video and notes in a stable two-column review room and degrades to a clear unavailable state for historical records whose source object no longer exists.

Acceptance evidence:

- Private R2 playback was verified in the browser.
- Timestamped notes were created and rendered at their captured times.
- Client approval was persisted and advanced the project to final delivery.
- Lint, type checking, database validation, tests, and production build pass through `npm run check`.
