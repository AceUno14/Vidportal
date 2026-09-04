# Storage Lifecycle

- Status: Approved v1 policy
- Last updated: 2026-08-28

This document defines where VidPortal stores files, when they become ready or visible, how interrupted operations recover, and when provider objects may be removed. The policy follows the locked rules in [Milestone 1](./milestone-1-foundation.md).

## 1. Storage responsibilities

### Cloudflare R2

The private R2 bucket stores durable project files:

- Raw footage and source assets.
- Reference images, audio, documents, and project attachments.
- Exact originals that the workflow must retain.
- Final/full-resolution deliverables.

### Review playback (free v1)

The implemented v1 reuses verified private R2 video assets for browser playback through short-lived, authorized presigned URLs. Review records, timestamped notes, and decisions stay in PostgreSQL. This keeps the working product inside the selected free infrastructure while preserving project and client authorization.

### Cloudflare Stream (optional future upgrade)

Stream may later store private review playback versions that need adaptive encoding or provider-side processing. It is not required by the current v1 and is not the canonical home for full-resolution final delivery.

### PostgreSQL

PostgreSQL stores metadata and authorization state, not multi-gigabyte file bodies. At minimum, it tracks the workspace/project relationship, uploader, original display metadata, server-generated provider identifier, asset category, explicit visibility, processing/readiness state, and lifecycle timestamps.

## 2. Object identity and isolation

R2 object keys are generated on the server and use opaque IDs rather than a user filename as identity. A conceptual layout is:

```text
workspaces/{workspaceId}/projects/{projectId}/{category}/{assetId}
```

The exact key format is an implementation detail, but it must:

- Make workspace and project ownership unambiguous.
- Prevent user-controlled traversal or key collision.
- Preserve the original filename as validated database metadata rather than trusting it as a storage path.
- Avoid overwriting an existing asset when a user uploads another file with the same display name.

Buckets are private. Every browser upload, download, or playback request begins with application authorization; knowing a provider key or video ID grants no access.

## 3. Asset visibility

Visibility is explicit metadata and is separate from readiness:

- `INTERNAL`: visible to owner/admin and assigned members only.
- `CLIENT`: visible to the associated client after the asset is ready.
- `PUBLISHED`: a ready final deliverable authorized for client download.

An uploaded object is not automatically visible. Provider presence, application readiness, and user visibility are separate facts.

Client users may download only ready `PUBLISHED` deliverables on associated projects. Internal/source assets never become client-downloadable merely because their R2 URLs exist.

## 4. R2 upload lifecycle

### Authorization

Before any bytes transfer, VidPortal validates the authenticated user's workspace/project access and declared filename, byte size, content type, file category, upload policy, expiry, and rate limits. It creates a server-owned upload session and storage key.

`UploadSession` must include at least:

- Workspace and project identifiers.
- Uploading user identifier.
- Expected filename, byte size, and content type.
- Server-generated R2 object key.
- Provider upload ID when multipart applies.
- Single-part or multipart upload type.
- Status, created timestamp, and expiration timestamp.

### Transfer

Small files may use one presigned `PUT`. Large files use multipart transfer. In either case, bytes move directly from the browser to R2 and do not pass through the Next.js application.

Multipart v1 behavior includes:

- Automatic retry of a failed part.
- Server-side `listParts` recovery.
- User cancellation and provider abort.
- Refresh recovery after the user reselects the same local file and its authorized metadata still matches.

V1 does not promise cross-device resume or guaranteed recovery of a multi-gigabyte local `File` object without reselection.

### Verification and readiness

After the provider reports completion, VidPortal performs `HeadObject`. The object key and resulting byte size must match the authorized upload metadata; content metadata is checked against permitted/expected values where supported. The application also verifies session ownership, scope, status, and expiry.

Only a verified object produces a ready `FileAsset`. A browser callback alone cannot do so. A mismatch remains unavailable and is reconciled or cleaned up safely.

## 5. Incomplete multipart expiry

Incomplete R2 multipart uploads follow the bucket's configured provider lifecycle. With the default R2 configuration, incomplete multipart uploads are automatically aborted after seven days.

VidPortal `UploadSession` expiry must not exceed the underlying provider upload lifetime. Extending an application database timestamp does not extend the provider upload. V1 never extends an existing multipart upload beyond the provider lifetime; an expired upload starts a new multipart upload and receives a new provider upload ID.

The application cleanup/reconciliation schedule is configured from the same lifecycle decision. It should:

- Mark expired application sessions terminal and refuse new part signing or completion.
- Request provider abort for abandoned uploads when they still exist.
- Treat an already provider-aborted or missing upload as an idempotent cleanup outcome.
- Avoid deleting a verified ready object merely because its former upload session expired.
- Detect orphaned non-ready metadata and provider operations without making them client-visible.

If the bucket lifecycle is changed from seven days, the application maximum must be reviewed and adjusted before deployment so it remains no longer than the provider lifetime.

## 6. Stream review lifecycle

Before provisioning a review upload, VidPortal validates project permission, declared filename, byte size, content type, upload policy, rate limits, expiry, and an appropriate maximum video duration.

Large review videos use TUS. The server provisions the upload with:

- `Tus-Resumable: 1.0.0`
- `Upload-Length`
- `Upload-Metadata`

Cloudflare-supported TUS metadata includes `maxDurationSeconds`, `expiry`, and `requiresignedurls`. `requiresignedurls` is the TUS metadata key; `requireSignedURLs` belongs to the JSON Direct Upload API and must not be substituted. The Cloudflare API token always remains server-side.

The conceptual review-version lifecycle is:

```text
authorized -> uploading -> processing -> ready -> submitted for review
                                      \-> failed
```

The exact database enum names are selected during schema implementation. In all cases:

- Browser upload completion does not mean processing readiness.
- A verified Stream webhook or reconciliation establishes readiness.
- Duplicate, delayed, and out-of-order webhooks are handled idempotently.
- Only ready, private, explicitly submitted versions are client-visible.
- Private playback authorization is short-lived and issued only after project access checks.
- Archived review versions are hidden but retained until an owner/admin explicitly deletes them.

Approval and comments remain attached to their historical `ReviewVersion` even if a later version is uploaded or the project is reopened.

## 7. Ready-file retention and deletion

- Active ready project assets have no age-based v1 deletion rule.
- Owner/admin explicitly archive or delete ready assets; permanent deletion is not a routine v1 UI action.
- A deleted R2-backed asset is soft-deleted for 30 days before provider-object cleanup.
- During the grace period, ordinary listing and download authorization treat it as deleted, while an authorized recovery path may restore it.
- After the grace period, cleanup deletes the provider object and records the result. Provider deletion is idempotent and retryable.
- Final/full-resolution deliverables are always stored in R2.
- Published deliverables must be unpublished or archived before an approved project is reopened.
- A completed project cannot be reopened through the v1 UI.

Review versions in Stream follow their separate archive rule; soft-deleting an R2 asset must not accidentally delete a Stream review version or its comments/decisions.

## 8. Database and activity retention

Activity records are append-only and retained for the lifetime of the workspace in v1. They record important domain actions but are not a substitute for operational logs or provider reconciliation state.

File and review database rows needed by comments, approvals, activity, or audit history should not be physically removed merely because a provider object is cleaned up. Use terminal metadata that makes the missing/deleted byte state explicit.

The prototype database has one protected export before the approved reset/reseed migration path. The idempotent demo seed becomes the canonical development dataset. Database backup retention outside that migration safeguard is an operations decision and must not be conflated with customer-file retention.

## 9. Reconciliation

Reconciliation covers state split across PostgreSQL and providers. It runs with bounded pages, retries, and structured outcomes.

R2 checks include:

- Active multipart sessions near or past expiry.
- Provider uploads already removed by lifecycle cleanup.
- Completed sessions whose objects still need `HeadObject` verification.
- Non-ready orphan objects and soft-deleted objects whose grace period elapsed.

Stream checks include:

- Versions stuck in uploading or processing beyond the expected window.
- Missing, failed, duplicate, or out-of-order webhook outcomes.
- Archived versions explicitly selected for provider deletion.

Reconciliation never grants visibility to repair uncertainty. Ambiguous items stay non-ready/non-visible and surface an operational error for review.

## 10. Cost and launch controls

Customer-specific storage plans and automated billing are out of scope for v1. VidPortal enforces a configurable deployment-wide guard for managed R2 objects, defaulting to 8,000,000,000 bytes, and exposes used-or-reserved and remaining capacity in the file interface. The guard assumes a dedicated application bucket; provider reconciliation and dashboard monitoring still cover objects created outside the normal application lifecycle.

Production-readiness evidence includes:

- Browser tests for CORS and readable multipart `ETag` values.
- Small multipart integration tests covering interruption, retry, `listParts`, completion, abort, and refresh/reselection recovery.
- Expiry and provider-lifecycle reconciliation tests.
- Stream TUS, private playback, webhook, and duration-policy tests.
- Exactly one real browser upload and authorized download larger than 5 GiB in staging.
- Verification that unauthorized and expired requests never produce upload, playback, or download authorization.
