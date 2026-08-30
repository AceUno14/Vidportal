# Milestone 2: Project Skeleton and Configuration

Status: LOCKED
Recorded: 2026-08-28
Scope: Incremental project organization, environment contract, test harness, CI, and foundation documentation only.

Milestone 2 does not modify the Prisma schema, authentication behavior, application routes, R2/Stream integrations, or later product features.

## 1. Milestone 1 lock confirmation

The locked Milestone 1 record now includes the final approved corrections:

- A valid completed client intake automatically transitions `INTAKE` to `READY`.
- R2 provider lifecycle remains authoritative; extending a VidPortal session never extends an underlying multipart upload.
- Stream TUS provisioning distinguishes the metadata key `requiresignedurls` from the JSON API field `requireSignedURLs` and records the required TUS headers.

## 2. Incremental structure

Only directories with real Milestone 2 files were introduced. No empty placeholder feature/server directories were created, and existing application features were not moved.

```text
.github/workflows/ci.yml
docs/
  architecture.md
  authorization.md
  milestone-1-foundation.md
  milestone-2-foundation.md
  r2-cors.md
  storage-lifecycle.md
src/lib/env/
  client.ts
  schema.ts
  server.ts
tests/
  e2e/health.spec.ts
  setup/vitest.setup.ts
  unit/environment.test.ts
  unit/health-route.test.ts
playwright.config.ts
vitest.config.mts
```

## 3. Environment contract

`.env.example` documents the locked target environment using placeholders only. `.gitignore` explicitly allows that example while continuing to ignore every real `.env*` file.

Server configuration is split into dependency-specific schemas and server-only
getters:

- `databaseEnvironmentSchema` / `getDatabaseEnvironment()` validate only the
  pooled, direct, and optional test PostgreSQL URLs.
- `authEnvironmentSchema` / `getAuthEnvironment()` validate only Better Auth's
  secret and base URL.
- `r2EnvironmentSchema` / `getR2Environment()` validate only Cloudflare account,
  private R2 credential, bucket, and presigned-URL TTL values.
- `streamEnvironmentSchema` / `getStreamEnvironment()` validate only Cloudflare
  account, Stream token/customer-code/webhook, and playback-token TTL values.
- `emailEnvironmentSchema` / `getEmailEnvironment()` validate only Resend API,
  sender, and optional reply-to values.

Each getter parses and caches only its own dependency group. Database setup and
validation therefore do not require credentials for Better Auth, R2, Stream, or
Resend. The complete `serverEnvironmentSchema` and `getServerEnvironment()` remain
available for full deployment/service verification and validate:

- PostgreSQL protocols for `DATABASE_URL`, `DIRECT_URL`, and optional `TEST_DATABASE_URL`.
- A minimum 32-character Better Auth secret and an HTTP(S) base URL.
- Cloudflare account, private R2 credential, Stream token/customer-code/webhook values.
- Resend API and valid sender/reply-to email addresses.
- Positive, bounded signed-URL/playback TTL configuration.
- A constrained structured-log level.

Environment parsing is lazy and dependency-scoped, so documenting future provider
configuration does not break the current prototype before those integrations
exist. `server-only` guards runtime access from accidental Client Component
imports.

VidPortal v1 currently has no browser-exposed environment variable. `src/lib/env/client.ts` documents that boundary; no secret or provider identifier is given a `NEXT_PUBLIC_*` prefix.

The temporary `JWT_SECRET` remains in `.env.example` only for current-prototype compatibility and is explicitly scheduled for removal at the Better Auth cutover.

## 4. Test foundation

Pinned foundation dependencies were added for:

- Zod environment validation.
- Vitest 4 with React and jsdom support.
- React Testing Library and jest-dom assertions.
- Playwright test orchestration.

The initial tests cover:

- The server-only database getter with an environment containing no Better Auth,
  R2, Stream, or Resend credentials.
- Acceptance of a complete target server environment and safe default values.
- A missing secret reported by variable name without printing its value.
- Malformed database URLs reported as normal validation errors rather than raw
  URL parser exceptions.
- The stable `/api/health` response contract as a unit test.
- The running application's `/api/health` contract as a Playwright request-only smoke test.

The smoke test does not require browser binaries. Browser journeys are added with their feature milestones.

Generated `.tmp` tool caches are excluded from ESLint so a health smoke run cannot
make a subsequent lint run inspect Playwright's transformed JavaScript.

Package scripts added:

| Script | Responsibility |
| --- | --- |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm test` | Run the deterministic Vitest suite once. |
| `npm run test:watch` | Run Vitest interactively in watch mode. |
| `npm run test:e2e` | Run Playwright tests. |
| `npm run check` | Run lint, type-checking, Prisma validation, tests, and production build in sequence. |

## 5. Continuous integration

`.github/workflows/ci.yml` runs on pushes, pull requests, and manual dispatch. It:

1. Uses Node.js 22 and `npm ci`.
2. Generates Prisma Client.
3. Runs lint and TypeScript.
4. Validates the Prisma schema.
5. Runs unit/integration tests.
6. Builds the production application.
7. Starts that production build and runs the request-only Playwright health smoke.

CI uses non-secret, non-provider-connected placeholder variables. Foundation checks make no external database, R2, Stream, or Resend request.

The workflow has read-only repository permissions, cancellation of superseded runs, a 20-minute job timeout, and Next.js build caching. Remote GitHub execution remains to be observed on the next push; its equivalent command sequence passes locally.

## 6. Foundation documentation

- `architecture.md` records browser, Next.js, PostgreSQL, provider, code, and failure boundaries.
- `authorization.md` translates the locked role matrix into server-enforcement rules and required denial tests.
- `r2-cors.md` records exact-origin browser CORS, required methods/headers, exposed `ETag`, presigned-request rules, and acceptance checks.
- `storage-lifecycle.md` records file ownership, visibility, upload recovery, authoritative provider expiry, `HeadObject` readiness, Stream TUS rules, retention, and reconciliation.
- `README.md` now distinguishes the working prototype from approved target components and documents the current setup and verification commands accurately.

## 7. Dependency advisory observation

`npm audit` currently reports one high-severity advisory propagated across three dependency nodes:

```text
prisma@7.10.0
  -> @prisma/config@7.10.0
    -> deepmerge-ts@7.1.5
```

The advisory concerns stack exhaustion when merging recursive object graphs. This chain belongs to the existing Prisma development CLI, not to a newly added runtime provider integration. Npm currently proposes downgrading Prisma to 6.12.0 as its available fix, which conflicts with the locked Prisma 7 architecture and would be a breaking change.

No forced audit fix or unsafe transitive override was applied. Track the advisory for a compatible Prisma/upstream resolution and reassess during the production security gate. Prisma configuration remains repository-controlled rather than accepting untrusted object graphs.

## 8. Verification gate

Final local verification on 2026-08-28:

| Check | Result |
| --- | --- |
| `npx prisma generate` | Passed; Prisma Client 7.10.0 generated. |
| `npm run lint` | Passed with zero errors or warnings. |
| `npm run typecheck` | Passed. |
| `npm run db:validate` | Passed; current Prisma schema remains valid. |
| `npm test` | Passed: 2 test files, 5 tests. |
| `npm run build` | Passed; all 13 existing routes generated. |
| `npm run test:e2e -- tests/e2e/health.spec.ts` | Passed: 1 Playwright smoke test. |

The application route map is unchanged from the Milestone 1 baseline.

## 9. Milestone 2 completion gate

Milestone 2 is locked. The approved completion conditions are satisfied:

- The incremental structure and validated environment contract.
- The foundation dependency additions and package scripts.
- The local unit/E2E test harness and CI workflow.
- The architecture, authorization, CORS, and storage-lifecycle documents.
- The documented Prisma CLI advisory disposition.
- No Milestone 3 or later implementation began.
