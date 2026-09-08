# VidPortal - Project Context

Last verified against the canonical source: 2026-09-09

## 1. Project Identity

VidPortal is a video-first project intake, review, feedback, and final-delivery portal for agencies, production houses, and freelancers.

It is a multi-tenant full-stack application. This file provides durable context for developing and releasing it.

The canonical project is the repository root that contains `.git`, `package.json`, `src/`, `prisma/`, and `docs/`. That root is the single source of truth.

## 2. Source-of-Truth Rules

- Executable source, migrations, tests, and current configuration are authoritative.
- `README.md` and `docs/` describe intended and previously verified behavior, but do not override the source.
- `TASKS.md` is the forward-looking roadmap, not evidence that work is implemented.
- Scope each change deliberately and keep unrelated changes out of it.
- Never overwrite, revert, reformat, or include unrelated changes.
- Never claim deployment or production behavior without direct verification.

## 3. Repository and Archives

- The canonical application lives only in the canonical repository root.
- Historical deployment experiments (including a former nested application copy) are stored outside the canonical repository and must not be used as production source.
- Historical review artifacts are kept in a private external archive.
- Do not merge, deploy, or source code from either archive.

## 4. Current State

Completed and verified:

- FileAsset client metadata exposure fix: nested CLIENT FileAsset metadata in `GET /api/projects` follows the authorized visibility rule (ready published final deliverables plus the client's own eligible SOURCE/REFERENCE uploads), and the response no longer contains the raw `storageKey`. Focused CLIENT regression tests cover the behavior.
- Repository hygiene: local-only material was removed or moved to private external archives, and the full local verification gate passes.

Verification snapshot recorded 2026-09-09:

- lint passed
- typecheck passed
- database schema validation passed
- 91/91 tests passed
- production build passed

Production deployment remains to be verified: a clean Netlify staging build, hosted function packaging, and a confirmed production origin remain acceptance gates.

## 5. Implemented Product

### Authentication and onboarding

- Better Auth email/password sessions using secure HTTP-only cookies.
- Workspace-owner registration through `/register` and `/api/auth/signup`.
- Public Better Auth signup is disabled in favor of atomic workspace-aware onboarding.
- Login/logout and current authentication context.
- Active-workspace switching stored on the session.
- Client-login creation route.

### Tenancy and authorization

- Canonical workspace-scoped data model.
- Roles: `OWNER`, `ADMIN`, `MEMBER`, and `CLIENT`.
- Membership status: `ACTIVE` and `INACTIVE`.
- Workspace managers can access workspace projects.
- Members are limited through active project assignments.
- Clients are limited to their associated client record and projects.
- Composite workspace/resource relationships are used throughout the Prisma schema.
- Authorization policy and resource rules are documented in `docs/authorization.md`.

### Clients and projects

- Client management.
- Project creation, listing, detail, and updates.
- Project assignments.
- Project lifecycle: `INTAKE`, `READY`, `IN_PROGRESS`, `CLIENT_REVIEW`, `REVISIONS`, `FINAL_DELIVERY`, `COMPLETED`.

### Structured intake

- Versioned intake templates and immutable submission snapshots.
- Draft/submitted intake states.
- Validated structured answers.
- Client submission and project-state transitions.

### Files and storage

- Private Cloudflare R2 storage.
- Direct presigned single-part and multipart uploads.
- Upload initiation, part signing, recovery, completion, abort, and verification.
- File type/purpose/visibility/status controls.
- Deployment-wide configurable storage guard.
- Private authorized downloads.
- Soft deletion and lifecycle metadata.

### Review and delivery

- Private R2 video review playback through short-lived presigned URLs.
- Review versions.
- Timestamped comments.
- Client decisions: `APPROVED` and `CHANGES_REQUESTED`.
- Decision-driven project transitions.
- Explicit publication of final deliverables.
- Client access restricted to ready, published final files.
- Project completion guarded by the presence of a published final deliverable.
- Activity/audit records for important actions.

## 6. Current Stack

### Application

- Next.js 16 App Router with route handlers and client/server components
- React 19
- TypeScript
- Tailwind CSS 4

### Database and authentication

- PostgreSQL hosted on Neon
- Prisma 6.19.0 with the Neon serverless adapter
- Better Auth 1.7.2
- Zod 4

### Storage

- Cloudflare R2 through the AWS S3 SDK
- Presigned upload, playback, and download URLs

### Testing and deployment

- Vitest with Testing Library
- Playwright
- Netlify target deployment
- Node.js 22 target runtime

## 7. Architecture
VidPortal is a modular monolith:

```text
Browser
  -> Next.js App Router pages and route handlers
  -> Better Auth session resolution
  -> workspace/role/resource authorization
  -> feature validation and services
  -> Prisma with Neon adapter
  -> Neon PostgreSQL

Browser
  -> short-lived presigned requests
  -> private Cloudflare R2
```

Primary boundaries:

- `src/app/`: pages and HTTP route handlers.
- `src/server/`: authentication and authorization policy.
- `src/features/intake/`: intake schemas, service, and UI.
- `src/features/files/`: policies, schemas, quota, R2 provider, services, and UI.
- `src/features/reviews/`: review schemas, services, and UI.
- `src/lib/env/`: validated environment configuration.
- `src/lib/prisma.ts`: runtime Prisma/Neon client.
- `prisma/schema.prisma`: canonical data model.
- `prisma/migrations/`: migration history.
- `tests/unit/`: contract, policy, schema, environment, and UI tests.
- `tests/e2e/`: current browser/smoke coverage.
- `docs/`: architecture, authorization, storage, deployment, and completed-slice evidence.

## 8. Data Model

Current models:

- `User`, `Account`, `Session`, `Verification`
- `Workspace`, `Membership`, `Client`
- `Project`, `ProjectAssignment`
- `IntakeTemplate`, `IntakeTemplateVersion`, `IntakeSubmission`
- `FileAsset`, `UploadSession`
- `ReviewVersion`, `Comment`, `Approval`
- `Activity`

Tenant ownership must remain explicit. New queries must include workspace scope or use an authorization-derived resource predicate. Never trust a workspace, membership, client, project, file, review, or approval identifier supplied by the browser without server-side authorization.

## 9. Security Invariants

- Never expose `.env`, credentials, database URLs, R2 keys, presigned URLs, or user passwords in logs or client bundles.
- Never seed production. Demo credentials are development-only and publicly documented.
- Never run `prisma migrate reset`, `migrate dev`, or `db push` against production or irreplaceable data.
- Review the reset-only historical workspace migration before any production migration operation.
- Use `DATABASE_URL` for the Neon runtime connection and `DIRECT_URL` for Prisma administrative commands.
- Keep R2 private; access occurs through short-lived authorized URLs.
- R2 object keys must be generated server-side and include workspace/project ownership; raw storage keys are not part of API responses.
- CLIENT FileAsset metadata follows the authorized visibility policy.
- Validate upload metadata before reserving storage or signing requests.
- Preserve active-transfer and storage-quota controls.
- Require exact resource authorization before playback, download, review, decision, publication, or completion.
- Do not reveal cross-tenant resource existence through different error behavior.
- Project state transitions must be explicit and validated.
- Completion and final publication must retain their transactional activity records.

## 10. Deployment-Compatibility Work

The release includes a deployment-compatibility slice covering:

- Prisma packages moving from 7.10.0 to 6.19.0.
- Prisma generator changing to `prisma-client-js` with `engineType = "client"`.
- Runtime client import changing to the generated WASM entry.
- Explicit schema `url` and `directUrl` configuration.
- Signup database-error handling.
- Netlify configuration and deployment documentation.
- Related contract-test updates.

Keep this slice reviewable as one coherent change and keep unrelated feature development out of it.

## 11. Remaining Priorities

The ordered work is maintained in `TASKS.md`. The immediate priorities are:

1. Finish and verify the current Prisma/Netlify compatibility slice.
2. Validate a clean Node 22 install/build and Netlify function packaging.
3. Deploy to fixed staging with isolated Neon/R2 credentials.
4. Exercise the complete role-based product flow in staging.
5. Expand E2E coverage beyond the health endpoint.
6. Add upload reconciliation/expiry operations and verify R2 administrative settings.
7. Remove remaining prototype compatibility adapters after callers use canonical shapes.
8. Finish portfolio documentation and record a verified live URL.

Cloudflare Stream and transactional email are optional future enhancements, not current release requirements.

## 12. Verification Standard

Use the smallest relevant checks during implementation, then the full gate before completing a milestone:

```powershell
npm run lint
npm run typecheck
npm run db:validate
npm run test
npm run build
```

`npm run check` runs the full local gate. Use the health smoke test when appropriate:

```powershell
npm run test:e2e -- tests/e2e/health.spec.ts
```

Before deployment, also verify:

- clean `npm ci` on Node 22
- migration status against the intended database
- Netlify adapter/function packaging
- authenticated database routes on staging
- R2 single-part and multipart transfer
- private playback and final download
- role and cross-workspace denials
- no demo credentials in production

## 13. V1 Boundaries

Keep these out of the release-critical path unless scope changes explicitly:

- Cloudflare Stream transcoding/adaptive playback
- transactional email notifications
- billing or storage plans
- public file delivery
- autonomous AI features
- broad analytics
- mobile-native applications

## 14. Definition of Done

A task is complete only when:

- source and tests implement the acceptance criteria
- authorization and tenant scope are preserved
- relevant commands pass
- failure and recovery behavior is handled
- documentation matches actual behavior
- no unrelated changes were overwritten

VidPortal is portfolio-ready when the clean repository builds in CI, staging passes the full owner/member/client workflow, private R2 boundaries are verified, the deployment is reproducible, and the GitHub/live URLs are documented.