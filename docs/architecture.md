# VidPortal Architecture

- Status: Approved target architecture
- Applies to: VidPortal v1
- Last updated: 2026-08-28

This document describes the architecture that Milestones 2 through 12 will implement. It is a target-state decision record, not a claim that every component is already present. Product rules in [Milestone 1](./milestone-1-foundation.md) are authoritative if a summary here is ambiguous.

## 1. Architecture decision

VidPortal v1 is a modular Next.js monolith backed by managed PostgreSQL. The application owns identity, authorization, project workflow, metadata, and provider coordination. Large file bytes travel directly between the browser and the appropriate Cloudflare service.

```text
Browser
  |
  |-- pages, forms, small API requests --------------------+
  |                                                        |
  |-- presigned single/multipart file transfer --> R2      |
  |                                                        v
  |-- authorized TUS review-video transfer -----> Stream  Next.js
                                                           |-- feature services
                                                           |-- authorization
                                                           |-- provider adapters
                                                           |-- webhooks
                                                           |
                                                           +--> PostgreSQL
                                                           +--> Resend
```

The deployment target is:

- Vercel for the Next.js application.
- Neon PostgreSQL for relational application data.
- Cloudflare R2 for original assets, documents, and final deliverables.
- Cloudflare Stream for private review playback versions.
- Resend for transactional email.

This design keeps operations manageable for one developer while preserving clean domain and infrastructure boundaries. V1 does not introduce a separate API server, job-service deployment, GraphQL layer, or microservices.

## 2. Runtime boundaries

### Browser

The browser renders the workspace UI and handles interactive workflows such as intake forms, upload progress, video playback, and timestamp capture. It may receive short-lived, narrowly scoped upload or playback authorization.

The browser must never receive:

- Database credentials.
- R2 access-key credentials.
- The Cloudflare Stream API token.
- The Resend API key.
- Better Auth's server secret.

The browser never sends a multi-gigabyte file body through a Next.js route. It sends metadata to VidPortal, receives limited provider authorization, and transfers bytes directly to R2 or Stream.

### Next.js application

Next.js App Router remains the single application deployment. Its responsibilities are:

- Render authenticated pages and initial server data.
- Terminate authenticated application requests.
- Validate request and environment data.
- Enforce workspace, role, assignment, and client association rules.
- Execute business rules and database transactions.
- Create short-lived upload, download, and playback authorization.
- Coordinate R2 multipart operations through server-owned upload sessions.
- Provision Stream TUS uploads and process verified webhooks.
- Schedule or send transactional email after successful mutations.

Route handlers and Server Actions are transport adapters. They should parse input, call a feature service, and translate the result. They must not duplicate tenant or workflow rules.

### PostgreSQL

PostgreSQL is the source of truth for application state, including:

- Users, sessions, workspaces, and memberships.
- Clients, projects, and project assignments.
- Intake definitions, immutable submission snapshots, and answers.
- File metadata and upload-session authorization.
- Review-version metadata, comments, and immutable decisions.
- Branding settings and append-only activity.

Provider readiness is not inferred from a browser response. R2 objects are verified before a file asset becomes ready, and Stream processing readiness is established by a verified provider webhook or reconciliation.

### Provider storage

R2 and Stream contain bytes but do not decide application authorization. Object identifiers and provider IDs are resolved from authorized database records; user-provided provider identifiers are never trusted by themselves.

R2 remains private. Downloads use short-lived presigned URLs issued only after VidPortal authorizes the user. Stream review playback requires signed playback authorization.

## 3. Code organization and dependency direction

The target source tree separates routing, domain features, and infrastructure:

```text
src/
  app/             routes, layouts, boundaries, thin HTTP handlers
  components/      shared UI and layout primitives
  emails/          React Email templates
  features/        domain UI, schemas, queries, services, permissions
  generated/       generated Prisma client
  lib/             small environment-independent helpers
  server/          server-only auth, database, email, storage, and video adapters
  types/           truly shared application types
```

The dependency direction is:

```text
app/routes -> feature service -> server adapter
     |              |
     +-> schema     +-> domain rules
```

Key rules:

- `src/app` owns URLs and framework boundaries, not reusable business logic.
- `src/features` owns use-case rules and feature-specific validation.
- `src/server` owns secrets and external-system clients and must never be imported into client components.
- `src/lib` remains small and domain-neutral; it is not a catch-all service directory.
- Generated Prisma output lives in `src/generated/prisma` and is not hand-edited.
- Empty directories are not created merely to mirror the target tree.

## 4. Request and event flows

### Authenticated application request

1. Resolve the server-side Better Auth session from secure cookies.
2. Resolve the requested workspace from the route and database.
3. Require an active membership and the resource-specific access rule.
4. Validate input with the feature schema.
5. Execute the mutation and append important activity in the same transaction where practical.
6. Return a safe response; do not expose secrets, provider credentials, or database errors.

`src/proxy.ts` may provide optimistic redirects for missing sessions, but it is never an authorization boundary.

### R2 asset upload

1. Authorize the workspace/project and declared file metadata.
2. Create a server-owned `UploadSession` and server-generated object key.
3. For a small file, issue narrowly scoped single-part authorization. For a large file, create a provider multipart upload and sign individual part operations.
4. Transfer bytes from the browser directly to R2.
5. Support retry, abort, and recovery through server-side `listParts` as defined in the storage documents.
6. Complete the provider upload, run `HeadObject`, and compare the result with authorized metadata.
7. Mark `FileAsset` ready only after verification succeeds.

### Stream review upload

1. Authorize project access and validate filename, type, declared byte size, expiry, rate limits, and maximum video duration.
2. The server provisions a private TUS upload using `Tus-Resumable`, `Upload-Length`, and Cloudflare-supported `Upload-Metadata` keys.
3. The browser uploads directly to the returned TUS endpoint without seeing the Cloudflare API token.
4. A verified, idempotently processed Stream webhook updates processing state.
5. Only a processed, ready, private version can be submitted for client review.

The TUS metadata key `requiresignedurls` must not be confused with the JSON Direct Upload API field `requireSignedURLs`.

### Review decision

1. Authorize the client against the review version's workspace, associated client record, project, visibility, and review state.
2. Create one immutable `APPROVED` or `CHANGES_REQUESTED` decision for that `ReviewVersion`.
3. Apply the corresponding project transition in the same transaction.
4. Append activity and trigger notification work only after the mutation succeeds.

## 5. Data and tenant model

The target tenant root is `Workspace`. A global `User` participates through `Membership`; role and workspace access are not stored as a single permanent attribute on the user.

All workspace-owned resources carry a workspace identifier directly or have an unambiguous parent chain to one. Service queries must include tenant scope. Unique constraints and compound indexes should include workspace scope wherever identifiers are tenant-local.

The target model includes at least:

- `User`, `Account`, `Session`, and `Verification` for identity and authentication.
- `Workspace` and `Membership` for tenancy and roles.
- `Client`, `Project`, and `ProjectAssignment` for customer and internal access.
- Versioned intake definitions and immutable submissions.
- `FileAsset` and `UploadSession` for durable file metadata and provider coordination.
- `ReviewVersion`, version-scoped `Comment`, and immutable `Approval` decisions.
- `Activity` for an append-only audit-oriented timeline.

`Client` and `Activity` already exist in the prototype schema. Milestone 3 migrates them into this model rather than introducing them as new concepts. The current prototype database is backed up, then may be reset and canonically reseeded as approved in Milestone 1.

## 6. Consistency and failure handling

- Mutations that change workflow state and record their activity should be atomic where practical.
- Repeated review decisions, webhook deliveries, upload completions, and notification triggers must be idempotent.
- Provider webhooks are authenticated before parsing into domain events and tolerate duplicate, delayed, and out-of-order delivery.
- A browser success callback is provisional; provider verification controls readiness.
- Provider calls and database transactions cannot form one distributed transaction. Store explicit intermediate states and reconcile incomplete operations.
- Application cleanup must be retry-safe. A missing provider object should not make repeated cleanup fail permanently.
- Logs include correlation and internal resource identifiers but exclude secrets, signed URLs, reset/invitation tokens, and sensitive intake content.

## 7. Environment isolation

Development, staging, and production use separate database and provider resources wherever practical. Each environment has explicit application origins and secrets.

- Runtime database traffic uses the pooled `DATABASE_URL`.
- Migrations and administrative Prisma commands use `DIRECT_URL` through `prisma.config.ts`.
- Integration tests use an isolated `TEST_DATABASE_URL`.
- R2 CORS permits only fixed, known origins; arbitrary preview origins are not allowed.
- No provider or database secret is exposed through `NEXT_PUBLIC_*` variables.

## 8. V1 boundary

This architecture supports the locked v1 workflow: structured intake, direct large-file exchange, project status tracking, private timestamped review, decisions, final delivery, and basic workspace branding.

The architecture does not add payments, contracts, AI features, advanced analytics, native applications, live collaborative editing, arbitrary custom roles, custom domains, enterprise SSO, public APIs, third-party production integrations, or advanced workflow automation.

Architecture changes or new v1 capabilities require a genuine implementation blocker and an explicit decision; convenience alone is not sufficient.
