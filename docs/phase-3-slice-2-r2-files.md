# Phase 3 — Slice 2: Direct project-file exchange

Status: implementation and live Cloudflare acceptance completed; configurable storage guard added on 2026-09-03.

This is the second vertical slice in Phase 3, Prompt 4 of the 1-Day Vibe Coding System. It replaces the prototype 25 MB server upload and permanent local-file deletion with an authorized browser-to-R2 transfer lifecycle.

## Working flow

1. An authorized project participant selects a source, reference, or attachment and declares its filename, byte size, content type, and purpose.
2. VidPortal validates the declaration, project access, role, project state, active-transfer limit, and remaining deployment storage.
3. The server creates an opaque, tenant-scoped `FileAsset` and `UploadSession`; a browser-provided storage key or provider upload ID is never accepted.
4. Files up to 100 MiB use one short-lived presigned `PUT`. Larger files use R2 multipart upload with 64 MiB-or-larger parts and no more than 10,000 parts.
5. The browser transfers bytes directly to private R2, reports progress, retries failed multipart parts up to three times, and requires a readable `ETag` as browser CORS evidence.
6. A paused multipart transfer can recover provider parts after the user reselects the same local file. The filename, byte size, and content type must still match.
7. Completion uses provider-side parts, then `HeadObject` verifies the exact byte size and expected content type before the asset becomes `READY` and a `FILE_READY` activity is appended.
8. Authorized downloads receive a short-lived presigned `GET`; clients receive download authorization only for ready, published final deliverables.

## Authorization and lifecycle

- Owner/admin can upload to any accessible workspace project and cancel any project transfer.
- Assigned members can upload to assigned projects and manage their own transfer.
- Associated clients can upload only source footage and creative references to their client's projects, and can manage only their own transfer.
- Completed projects are locked for new uploads.
- Each membership may have at most five active, unexpired transfers.
- New transfers reserve capacity atomically under the deployment-wide storage guard before R2 authorization is issued.
- Pending, ready, archived, and soft-deleted assets count against the guard; aborted and failed transfers release their reservations, while soft-deleted bytes remain counted until provider cleanup.
- Upload sessions expire after 24 hours, below the locked seven-day R2 multipart-provider lifecycle.
- A failed or unverified provider operation never becomes ready or downloadable.
- Owner/admin removal is now a database soft delete with a 30-day `purgeAfter` date. Provider-object cleanup remains a later reconciliation operation; routine UI removal no longer deletes bytes immediately.

The project detail response no longer exposes storage keys or internal file rows. Its file metric is a visibility-aware count, while the dedicated files endpoint returns a safe role-scoped representation.

## Storage guard

`R2_STORAGE_QUOTA_BYTES` configures a deployment-wide ceiling for VidPortal-managed objects and defaults to `8000000000` bytes. New reservations are serialized with a PostgreSQL transaction-level advisory lock, so concurrent upload requests cannot both consume the same remaining capacity. The dedicated files endpoint returns the limit, used-or-reserved bytes, remaining bytes, and utilization percentage without exposing object keys.

The guard assumes VidPortal has a dedicated R2 bucket. Objects added manually outside VidPortal are not represented in its database accounting and must not share this bucket. Provider reconciliation remains responsible for releasing retained rows only after object cleanup is verified.

## API surface

- `GET /api/projects/[id]/files`: list visible files, available upload purposes, upload availability, and the safe deployment storage snapshot.
- `POST /api/projects/[id]/files`: validate metadata, create the database upload boundary, and provision single-part or multipart authorization.
- `GET /api/projects/[id]/uploads/[uploadId]`: reauthorize a single-part transfer or list uploaded multipart parts for same-file recovery.
- `POST /api/projects/[id]/uploads/[uploadId]/part`: issue authorization for one bounded multipart part.
- `POST /api/projects/[id]/uploads/[uploadId]/complete`: complete multipart work where needed, verify provider state, and make the file ready atomically with activity evidence.
- `POST /api/projects/[id]/uploads/[uploadId]/abort`: abort provider multipart work before marking the session terminal.
- `POST /api/projects/[id]/files/[fileId]/download`: issue authorized, short-lived download access.
- `DELETE /api/projects/[id]/files/[fileId]`: soft-delete a ready file for 30-day retention; it does not delete the provider object.

## Transfer UI

The project page now uses a responsive **transfer runway** rather than a generic file input:

- Explicit file-purpose selection using the user's vocabulary.
- Drag-and-drop and keyboard-accessible file selection.
- Direct-transfer progress, verification status, cancellation, and actionable error feedback.
- Same-file reselection for interrupted transfer recovery.
- A role-scoped asset register with verified, paused, and failed states.
- Secure download and permission-aware removal actions.
- A locked state for completed projects and directed empty/loading/error states.
- A storage-runway meter showing available, used-or-reserved, and configured capacity in Cloudflare-style decimal GB.
- Reduced-motion support and visible focus treatment.

The transfer-runway treatment follows the established VidPortal production language: navy resembles the production slate, while the segmented baseline echoes an edit timeline without adding decorative controls.

## Dependencies

The official S3-compatible AWS SDK packages are exact-pinned in the lockfile:

- `@aws-sdk/client-s3@3.1121.0`
- `@aws-sdk/s3-request-presigner@3.1121.0`

Production dependency audit passed with no reported advisories. The existing three high-severity development advisories in the Prisma CLI dependency chain remain unchanged and do not have a non-breaking automated fix.

## Verification completed

- ESLint.
- Next.js route type generation and TypeScript.
- Prisma schema validation.
- Eleven Vitest files with 66 passing tests covering metadata validation, role policy, opaque key construction, single/multipart selection, bounded parts, direct-transfer contracts, retry/recovery, `ETag` handling, provider verification, soft deletion, quota defaults, capacity calculation, and atomic reservation contracts.
- Next.js production build with the complete 21-route application surface.
- `npm audit --omit=dev` completed without production advisories.

Automated implementation checks did not contact Cloudflare or create upload-session data. Live acceptance began separately on 2026-08-31 after the user configured a private development bucket and restricted credentials.

## Live acceptance evidence

Completed on 2026-08-31:

- Activated R2 and created the private Standard-class `vidportal-development` bucket in Asia-Pacific; public access and the public development URL remain disabled.
- Applied exact-origin CORS for `http://localhost:4322` with `GET`, `HEAD`, and `PUT`, the required request headers, exposed `ETag`, and a 3,600-second preflight cache.
- Confirmed the default incomplete-multipart abort rule remains enabled at seven days.
- Created a six-month user token with Object Read & Write limited to `vidportal-development`; values are stored only in the ignored local `.env`.
- Passed a read-only `ListObjectsV2` connection check with the restricted credentials.
- Received a successful `204` CORS preflight for `PUT` from the exact local origin.
- Uploaded the existing 391-byte `public/file.svg` fixture as a client creative reference through the complete metadata authorization, presigned single-part `PUT`, provider `HeadObject` verification, and database completion path.
- Confirmed the resulting asset is `READY`, the client-visible file count is one, and the bucket contains exactly one object totaling 391 bytes.
- Logged in as the demo manager, requested an authorized download through VidPortal, and downloaded the private R2 object through the returned short-lived URL.
- Confirmed the downloaded file was 391 bytes and its SHA-256 digest exactly matched the original `public/file.svg` fixture.
- Initiated a 105,906,176-byte multipart upload, uploaded its 64 MiB first part, deliberately paused, and recovered that exact provider-side part through VidPortal before continuing.
- Uploaded the remaining 37 MiB part, recovered the complete two-part provider state, completed the upload, and passed the server-side R2 size and content-type verification.
- Downloaded the completed multipart object through a manager-authorized VidPortal URL and confirmed its byte count and SHA-256 digest exactly matched the generated source fixture.
- Started a second multipart upload, stored its first 64 MiB part, cancelled it through VidPortal, and confirmed the aborted session rejected subsequent recovery.
- Reviewed the authenticated project and transfer interface at a 390-by-844 mobile viewport, confirmed the sidebar collapse and zero horizontal overflow, and raised the mobile purpose and file controls to 44-pixel touch targets.

No credential values were printed or committed.

## Acceptance status

Phase 3 Slice 2 implementation, automated checks, live R2 upload/download acceptance, recovery and cancellation acceptance, desktop/mobile interface review, and the configurable deployment storage guard are complete.

The required environment names are `CLOUDFLARE_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY`. Optional tuning uses `R2_PRESIGNED_URL_TTL_SECONDS` and `R2_STORAGE_QUOTA_BYTES`; the storage guard defaults to `8000000000` bytes.

## Deferred work

- Scheduled expiry, orphan, and 30-day provider-object reconciliation.
- Owner/admin restore during the soft-delete grace period.
- Final-deliverable publication, which belongs to the final-delivery slice.
- Stream review-video upload, processing webhooks, and signed playback.
- The required single staging upload and download larger than 5 GiB, reserved for the production-readiness gate.
