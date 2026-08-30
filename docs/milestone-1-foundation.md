# Milestone 1: Product Rules and Baseline

Status: Locked and approved
Recorded: 2026-08-28
Scope: Product rules, authorization boundaries, migration safety, and the pre-implementation baseline only.

No schema reset, authentication migration, route restructuring, or provider integration is part of this milestone.

## 1. Role and access matrix

All permissions are enforced on the server. Hiding a control in the UI is never an authorization boundary.

| Work item | Owner | Admin | Member | Client |
| --- | :---: | :---: | :---: | :---: |
| View workspace | All workspace data | All workspace data | Membership and assigned-project context | Membership and associated-client context |
| Manage workspace ownership | Yes | No | No | No |
| Manage branding | Yes | Yes | No | No |
| Invite or remove admins | Yes | No | No | No |
| Invite or remove members and clients | Yes | Yes | No | No |
| Create, edit, or archive client records | Yes | Yes | No | No |
| View client details | All clients | All clients | Clients on assigned projects | Own associated client only |
| Create, edit, or archive projects | Yes | Yes | No | No |
| View projects | All workspace projects | All workspace projects | Assigned projects only | Projects for associated client only |
| Manage project assignments | Yes | Yes | No | No |
| Manage intake templates | Yes | Yes | No | No |
| Submit project intake | No | No | No | Associated projects only |
| Reopen submitted intake | Yes | Yes | No | No |
| Upload client-provided source/reference assets | Yes | Yes | Assigned projects | Associated projects |
| Upload and submit review versions | Yes | Yes | Assigned projects | No |
| Comment on a visible review version | Yes | Yes | Assigned projects | Associated projects |
| Resolve review comments | Yes | Yes | Assigned projects | No |
| Approve or request changes | No | No | No | Associated in-review version only |
| Perform internal project transitions | Yes | Yes | Assigned projects | No |
| Upload final deliverables | Yes | Yes | Assigned projects | No |
| Publish final deliverables | Yes | Yes | No | No |
| Download source/internal files | Yes | Yes | Assigned projects | No |
| Download published deliverables | Yes | Yes | Assigned projects | Associated projects |
| Delete ready assets | Yes | Yes | No | No |
| Abort an active upload | Any workspace upload | Any workspace upload | Own assigned-project upload | Own associated-project upload |
| View activity | All workspace activity | All workspace activity | Assigned-project activity | Client-safe associated-project activity |

Role invariants:

- A workspace has exactly one `OWNER` in v1.
- An `ADMIN` cannot grant, transfer, or remove ownership.
- A `MEMBER` requires a `ProjectAssignment` to access a project.
- A `CLIENT` membership is associated with one workspace `Client` record and can access only that client's projects.
- A client review decision is never created on behalf of a client by an internal user.
- Permanent deletion is not exposed as a routine v1 UI action; normal removal uses archive or soft-delete behavior.

## 2. Branching project lifecycle

```text
INTAKE -> READY -> IN_PROGRESS -> CLIENT_REVIEW

CLIENT_REVIEW -- CHANGES_REQUESTED --> REVISIONS --> CLIENT_REVIEW

CLIENT_REVIEW -- APPROVED --> FINAL_DELIVERY --> COMPLETED
```

| From | Trigger | To | Authorized actor |
| --- | --- | --- | --- |
| `INTAKE` | A valid completed client intake is submitted | `READY` | Automatic consequence of client submission |
| `READY` | Production begins | `IN_PROGRESS` | Owner, admin, or assigned member |
| `IN_PROGRESS` | A ready review version is submitted to the client | `CLIENT_REVIEW` | Owner, admin, or assigned member |
| `CLIENT_REVIEW` | Immutable `CHANGES_REQUESTED` decision | `REVISIONS` | Associated client reviewer |
| `REVISIONS` | A new ready review version is submitted | `CLIENT_REVIEW` | Owner, admin, or assigned member |
| `CLIENT_REVIEW` | Immutable `APPROVED` decision | `FINAL_DELIVERY` | Associated client reviewer |
| `FINAL_DELIVERY` | At least one ready final deliverable is published | `COMPLETED` | Owner or admin |

Lifecycle invariants:

- `APPROVED` and `CHANGES_REQUESTED` are immutable `Approval` decisions associated with one `ReviewVersion`.
- The project transition is a consequence of the decision and occurs in the same database transaction.
- A valid completed client intake automatically transitions the project from `INTAKE` to `READY`; v1 has no separate manual intake-acceptance step.
- A client cannot directly patch project status.
- A review version must be processed, ready, private, and explicitly submitted before a client can review it.
- Repeated review-decision requests are idempotent and do not create duplicate transitions.
- Published deliverables normally require an approved review version.
- An owner/admin approval bypass is allowed only with a required reason and an `APPROVAL_BYPASSED` activity event. It does not create a false client `Approval` record.

## 3. Reopening and comment policies

- Unresolved comments produce a visible warning but do not block a client decision.
- An owner or admin may reopen an approved project from `FINAL_DELIVERY` to `REVISIONS` before completion.
- Reopening preserves the historical approval, records an activity event, and requires a new `ReviewVersion` and new client decision.
- Published deliverables must be unpublished or archived before reopening an approved project.
- A `COMPLETED` project cannot be reopened through the v1 UI.
- Submitted intake may be reopened by an owner/admin only while the project is in `INTAKE` or `READY`.
- Intake is not overwritten after production begins. Corrections after `IN_PROGRESS` are recorded separately so the submitted snapshot remains auditable.

## 4. Storage and retention rules

- R2 stores raw footage, source assets, references, documents, exact originals that must be retained, and final deliverables.
- Stream stores review playback versions. Review uploads are not duplicated into R2 by default.
- Final/full-resolution deliverables are always stored in R2.
- Ready project assets are retained until an owner/admin explicitly archives or deletes them; v1 performs no age-based deletion of active project files.
- A deleted asset is soft-deleted for 30 days before provider-object cleanup, allowing recovery during the grace period.
- Incomplete R2 multipart uploads follow the bucket's configured provider lifecycle. With the default R2 configuration, incomplete multipart uploads are automatically aborted after seven days.
- VidPortal `UploadSession` expiry must not exceed the underlying provider upload lifetime.
- V1 does not extend an existing multipart upload beyond the provider lifetime. An expired upload starts a new multipart upload.
- Application cleanup and reconciliation remain aligned with the configured provider lifecycle.
- Archived Stream review versions are hidden but retained until explicitly deleted by an owner/admin.
- Activity records are append-only and retained for the lifetime of the workspace in v1.
- Storage quotas and automated customer billing are not v1 features, but usage must be observable before external launch.

File visibility is explicit metadata:

- `INTERNAL`: owner, admin, and assigned members only.
- `CLIENT`: visible to associated clients after the asset is ready.
- `PUBLISHED`: final deliverable visible for authorized client download.

## 5. Locked upload-recovery contract

V1 R2 recovery includes:

- Automatic retry of failed multipart parts.
- Server-side recovery using `listParts`.
- Cancellation and provider abort.
- After browser refresh, the user reselects the same local file and VidPortal recovers valid existing parts after matching the authorized upload metadata.

V1 does not promise cross-device resume or recovery of a multi-gigabyte browser `File` object without local-file reselection.

`UploadSession` must include at least:

- Workspace and project identifiers.
- Uploading user identifier.
- Expected filename, byte size, and content type.
- Server-generated storage object key.
- Provider upload ID where applicable.
- Single-part or multipart upload type.
- Status, creation time, and expiration time.

After completion, the server performs `HeadObject` and compares the resulting object with the authorized key, byte size, and permitted content metadata before marking `FileAsset` ready. Browser success alone is insufficient.

The core R2 integration suite uses smaller multipart fixtures to prove interruption, retry, `listParts`, completion, abort, and recovery. Exactly one real upload and download larger than 5 GiB is required in staging during the final production-readiness gate.

## 6. Locked Stream upload contract

VidPortal uses TUS for large Stream review uploads. Before provisioning one, the server validates:

- The authenticated user's workspace, project, role, and assignment/client access.
- The declared filename, file size, content type, and v1 upload policy.
- Upload-session expiry and rate limits.
- An appropriate declared maximum video duration.

The server provisions the TUS upload using:

- `Tus-Resumable: 1.0.0`
- `Upload-Length`
- `Upload-Metadata`

TUS `Upload-Metadata` uses Cloudflare's supported metadata keys, including `maxDurationSeconds`, `expiry`, and `requiresignedurls`.

The TUS metadata key `requiresignedurls` is distinct from the JSON Direct Upload API field `requireSignedURLs`; implementations must use the correct spelling for the selected protocol. The browser never receives the Cloudflare API token. The Stream webhook, rather than the browser, determines when a review version becomes ready.

## 7. Prisma migration facts

- The current Prisma schema already contains `Client`; it will be migrated and retained rather than introduced from scratch.
- The current Prisma schema already contains `Activity`; Milestone 3 explicitly migrates it to the workspace-based model and preserves its append-only purpose.
- The current prototype database is disposable unless an irreplaceable record is identified before Milestone 3.
- One export is required before reset. After the export, the approved strategy is reset and canonical reseeding rather than preservation of legacy JWT sessions and prototype-only authentication data.
- The idempotent demo seed becomes the canonical development dataset.

Current prototype row inventory:

| Model | Rows |
| --- | ---: |
| Agency | 1 |
| User | 1 |
| Client | 2 |
| Project | 2 |
| File | 1 |
| Comment | 0 |
| Invoice | 0 |
| IntakeForm | 0 |
| Session | 0 |
| Activity | 0 |

Backup/export evidence:

- File: `backups/pre-milestone-3-2026-08-28.json.gz`
- Format: gzip-compressed Prisma JSON export.
- Size: 938 bytes.
- SHA-256: `E120AACBB79C8DF3CE5C547BE86215FA6EDAC19B9F46B8935E4966F8DD8EF9BE`
- The export directory is git-ignored because it may contain sensitive prototype data.
- The source database was read but not modified.

The current PostgreSQL driver emitted a forward-compatibility warning for its SSL-mode interpretation. This must be resolved when the Neon runtime connection is configured in Milestone 3; it does not invalidate this export.

## 8. Verification baseline

Recorded against Next.js 16.3.3, React 19.2.8, Prisma 7.10.0, and TypeScript 5 on 2026-08-28.

| Check | Result |
| --- | --- |
| `npm run lint` | Passed with zero errors or warnings |
| `npx tsc --noEmit` | Passed |
| `npm run db:validate` | Passed; Prisma schema valid |
| `npm run build` | Passed; production bundle and route generation completed |

Generated routes at the baseline:

- `/`
- `/login`
- `/clients`
- `/projects/[id]`
- `/api/health`
- `/api/auth/login`
- `/api/auth/signup`
- `/api/clients`
- `/api/clients/[id]/create-login`
- `/api/projects`
- `/api/projects/[id]`
- `/api/projects/[id]/files`
- `/api/projects/[id]/files/[fileId]`

## 9. Milestone 1 completion gate

Milestone 1 is locked and complete. All of the following remain true:

- The role matrix and branching lifecycle are accepted.
- Reopening, comment, approval-bypass, archival, and retention behavior are accepted.
- The backup/export exists and its checksum is recorded.
- Lint, TypeScript, Prisma validation, and production build pass.
- No Milestone 2 or later architecture, schema, authentication, or feature implementation has begun.
