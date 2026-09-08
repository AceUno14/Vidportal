# VidPortal - Roadmap

Last updated: 2026-09-09

## Working Rules

- The canonical project is the repository root that contains `.git`, `package.json`, `src/`, `prisma/`, and `docs/`.
- Treat source, migrations, and tests as truth; documentation is supporting evidence.
- Keep changes small and reviewable; preserve unrelated work.
- Destructive cleanup requires explicit maintainer approval.
- Check a task only after its acceptance criteria and verification pass.

## Current Baseline

Implemented v1 product slices:

- [x] Workspace-aware Better Auth onboarding and sessions.
- [x] Workspace, membership, role, and project-assignment authorization model.
- [x] Client and project management.
- [x] Structured, versioned client intake.
- [x] Private direct-to-R2 single-part and multipart file transfer.
- [x] Upload recovery, verification, quota guard, and soft deletion.
- [x] Private R2 review playback.
- [x] Timestamped comments and client approval/change requests.
- [x] Guarded final publication, client download, and project completion.
- [x] Canonical seed, verification script, migrations, unit tests, and health smoke test.
- [x] FileAsset metadata exposure security fix: CLIENT nested file metadata in `GET /api/projects` follows authorized visibility rules and no raw `storageKey` is serialized.
- [x] Focused CLIENT FileAsset regression tests; the full verification gate (lint, typecheck, unit tests, production build) passed at completion.

Known release gap: local v1 behavior is substantially implemented, but the Prisma/Netlify compatibility changes and hosted end-to-end deployment are not yet verified as a release.

Next phase: create the approved commits -> verify the resulting Git history -> push -> deployment verification -> production smoke testing -> portfolio screenshots.

## Approved Commit Structure

- Commit 1: Prisma / Netlify compatibility
- Commit 2: Signup reliability
- Commit 3: FileAsset metadata security
- Commit 4: Repository hygiene
- Commit 5: Deployment documentation
- Commit 6: Project context / roadmap

## Pre-Commit Review and Verification (completed)

- [x] FileAsset metadata security analysis, fix implementation, and regression testing.
- [x] Signup database-error regression test.
- [x] Repository hygiene review, nested repository archival, and `.vscode/`, local AI test artifact, and historical review ZIP dispositions.
- [x] Complete pre-commit diff review, commit-scope analysis, and final commit grouping.
- [x] Sensitive-data review of public documentation.
- [x] Verification gate: lint, typecheck, database schema validation, 91/91 tests, production build, and `git diff --check` all passed.

## Milestone 0 - Finish the Deployment-Compatibility Slice

- [x] Inventoried and classified every changed file (release work, local-only material, or unrelated work).
- [ ] Confirm the intended Prisma 6.19.0 downgrade and Neon/Netlify compatibility rationale.
- [ ] Verify `package.json` and `package-lock.json` agree exactly.
- [ ] Verify `prisma-client-js`, `engineType = "client"`, custom output, and generated WASM import work together.
- [ ] Verify `DATABASE_URL` and `DIRECT_URL` behavior across runtime, Prisma CLI, tests, and Netlify.
- [x] Verify workspace-owner signup returns a safe failure when the database is unavailable (focused unit test covers the generic 500 branch).
- [ ] Review `netlify.toml` and `docs/deployment.md` against the actual build/runtime behavior.
- [ ] Confirm the current ESLint exclusions are narrow and do not hide source problems.
- [x] Full verification gate without changing feature behavior (lint, typecheck, database schema validation, 91/91 tests, production build).
- [ ] Run the health smoke test.
- [x] Independent read-only review of the complete diff.
- [ ] Resolve any remaining release-blocking findings before committing.
- [x] Final file list and verification evidence compiled; commit grouping approved.

Acceptance criteria:

- A clean install can generate the Prisma client and build the application.
- Unit/contract tests reflect the selected Prisma configuration.
- No local copy, archive, secret, backup, or generated output is included accidentally.
- The deployment compatibility change is reviewable as one coherent slice.

## Milestone 1 - Repository Hygiene and Release Checkpoint

- [x] Reviewed the historical nested experiment repository (independent Git history, no canonical dependencies) and relocated it intact to a private external archive.
- [x] Restored repository-level lint: `npm run lint` passes again now that the historical copy is archived.
- [x] Dispositioned local-only material: editor settings kept local and ignored via `/.vscode/`, a disposable local test artifact deleted, and a historical review ZIP moved intact to a private external archive.
- [x] Reviewed public documentation for sensitive data (credentials, tokens, private paths, and archive locations).
- [ ] Verify `.gitignore` excludes environment files, backups, generated Prisma code, `.next`, test artifacts, and uploaded content.
- [ ] Scan tracked files and reachable commits for likely secrets without printing secret values.
- [ ] Confirm README route and feature claims match executable source.
- [ ] Confirm the GitHub remote and branch are correct.
- [ ] Create a release checkpoint only after maintainer approval.

Acceptance criteria:

- The intended release contains no duplicate app copy, local artifacts, credentials, or misleading documentation.
- The commit scope is understandable before deployment.

## Milestone 2 - Clean Node 22 and CI Verification

- [ ] Test `npm ci` from a clean checkout/cache context using Node.js 22.
- [ ] Confirm `postinstall` generates the expected Prisma client.
- [ ] Run lint, typecheck, Prisma validation, tests, and production build in CI.
- [ ] Confirm migrations and seed contract tests do not depend on an uncontrolled local database.
- [ ] Preserve or improve the GitHub Actions gate.
- [ ] Record the exact Node/npm versions and verification output.

Acceptance criteria:

- The repository passes from a clean Node 22 environment, not only an individual workstation.
- CI uses the lockfile and fails on lint, type, schema, test, or build regressions.
## Milestone 3 - Netlify Staging Deployment

- [ ] Create isolated staging Neon and private R2 resources.
- [ ] Configure Netlify environment variables without exposing values in Git or logs.
- [ ] Set a fixed staging HTTPS origin and matching `BETTER_AUTH_URL`.
- [ ] Configure exact-origin R2 CORS for the staging URL.
- [ ] Review migration status against the intended staging database.
- [ ] Apply migrations only after target confirmation and backup/safety checks.
- [ ] Verify Netlify's Next.js adapter and function packaging.
- [ ] Verify the generated Prisma WASM loader in deployed functions.
- [ ] Verify `/api/health`, registration, login/logout, workspace context, and authenticated reads.
- [ ] Record staging URL and deployment evidence without recording secrets.

Acceptance criteria:

- The deployed server can authenticate and query the correct staging database.
- Staging uses isolated credentials and does not expose the R2 bucket publicly.
- Deployment succeeds from the repository rather than local generated state.

## Milestone 4 - Full Role-Based Staging Acceptance

- [ ] Test owner onboarding and workspace creation.
- [ ] Test owner/admin client and project management.
- [ ] Test member access limited to active project assignments.
- [ ] Test client access limited to its own client record and projects.
- [ ] Test structured intake submission and state transition.
- [ ] Test single-part upload from the browser.
- [ ] Test multipart upload, interruption, recovery, completion, and ETag handling.
- [ ] Test private review playback and timestamped comments.
- [ ] Test change request and approval transitions.
- [ ] Test final-deliverable upload, publication, authorized client download, and completion.
- [ ] Test forbidden cross-workspace, cross-client, cross-project, file, review, and approval identifiers.
- [ ] Capture repeatable acceptance evidence.

Acceptance criteria:

- The owner/admin/member/client workflows behave according to `docs/authorization.md`.
- Cross-tenant and cross-resource attempts fail without leaking sensitive existence details.
- The complete intake-to-delivery lifecycle works on staging.

## Milestone 5 - Expand Automated E2E Coverage

- [ ] Add browser tests for registration, login, logout, and workspace context.
- [ ] Add owner client/project creation tests.
- [ ] Add client intake tests.
- [ ] Add role-denial tests for member/client boundaries.
- [ ] Add review comment and decision tests using controlled storage fixtures or a documented test seam.
- [ ] Add final publication/completion tests.
- [ ] Keep provider-dependent tests deterministic and safe for CI.
- [ ] Document which R2 flows remain staging-only acceptance tests.

Acceptance criteria:

- E2E coverage extends beyond `/api/health` and covers the critical business journey.
- CI tests are deterministic and do not require production credentials.

## Milestone 6 - Storage Operations and Recovery

- [ ] Audit incomplete multipart expiry against `docs/storage-lifecycle.md`.
- [ ] Implement or operationalize expiry/abort cleanup for stale upload sessions.
- [ ] Add reconciliation for database assets versus provider objects.
- [ ] Verify storage quota behavior under concurrent reservations.
- [ ] Verify deleted/archived asset retention and purge policy.
- [ ] Verify bucket lifecycle rules with an appropriately authorized operator.
- [ ] Verify bucket privacy, public-development URL state, and credential scope.
- [ ] Add monitoring/logging for failed completion, recovery, and reconciliation without logging secrets or presigned URLs.

Acceptance criteria:

- Stale uploads and orphaned objects have a documented, tested recovery path.
- Storage accounting can be reconciled.
- Operational controls match the documented lifecycle.

## Milestone 7 - Remove Prototype Compatibility Debt

- [ ] Inventory every use of `src/lib/prototype-compat.ts`.
- [ ] Define canonical API response shapes for clients, projects, files, reviews, and auth context.
- [ ] Migrate one caller/route family at a time with contract tests.
- [ ] Remove obsolete adapters only after no callers remain.
- [ ] Update documentation and tests to canonical terminology.
- [ ] Avoid changing product behavior during response-shape migration.

Acceptance criteria:

- UI and APIs use canonical workspace-scoped shapes directly.
- Compatibility code is removed only when contract coverage proves it is unused.

## Milestone 8 - Product and Accessibility Polish

- [ ] Audit keyboard access, focus behavior, form labels, validation announcements, and dialogs.
- [ ] Verify responsive layouts for dashboard, clients, project details, intake, files, review, and delivery.
- [ ] Add consistent loading, empty, forbidden, unavailable, retry, and destructive-confirmation states.
- [ ] Improve navigation and role-aware action visibility without relying on UI hiding for authorization.
- [ ] Verify large filenames, long client/project names, long comments, and timezone/date display.
- [ ] Run automated accessibility checks and focused manual review.

Acceptance criteria:

- Critical workflows are usable by keyboard and on common mobile/desktop sizes.
- Failure states guide recovery and do not expose internal errors.

## Milestone 9 - Production Release

- [ ] Choose and configure the canonical production domain.
- [ ] Provision isolated production Neon and private R2 resources.
- [ ] Configure exact production auth origin and R2 CORS.
- [ ] Verify backup/restore and migration rollback limitations.
- [ ] Confirm no demo accounts or shared demo passwords exist in production.
- [ ] Run the database release gate against the confirmed production target.
- [ ] Deploy the reviewed commit.
- [ ] Run authentication, workspace, database, R2, review, and delivery smoke tests.
- [ ] Verify secure cookies, HTTPS redirects, security headers, and error/log behavior.
- [ ] Retain the prior deploy and database backup.
- [ ] Record the GitHub repository and live URL in README.

Acceptance criteria:

- Production runs the reviewed commit against the intended isolated services.
- Core workflows and access boundaries are verified after deployment.
- Recovery information and release evidence are recorded.

## Milestone 10 - Portfolio Case Study

- [ ] Replace prototype language with an accurate v1 status where justified.
- [ ] Add polished screenshots with synthetic data only.
- [ ] Document the problem, users, constraints, and end-to-end workflow.
- [ ] Explain the workspace/role/resource authorization model.
- [ ] Explain direct-to-R2 transfer, multipart recovery, quota guard, and private delivery.
- [ ] Explain why private R2 review was chosen for the free v1 and Stream was deferred.
- [ ] Add architecture and lifecycle diagrams if they improve comprehension.
- [ ] Summarize automated and staging verification evidence.
- [ ] Document limitations honestly.
- [ ] Add GitHub and live-demo links.

Acceptance criteria:

- The case study demonstrates full-stack architecture, multi-tenant security, cloud storage, workflow design, and production delivery.
- Every claim is supported by source or recorded verification.

## Optional Post-v1 Work

Do not begin these until the release-critical milestones are complete and scope is explicitly approved.

- [ ] Cloudflare Stream adaptive playback and transcoding.
- [ ] Transactional email notifications.
- [ ] Richer analytics and reporting.
- [ ] Customer-specific storage plans or billing.
- [ ] Additional identity providers.

## Review and Release Gates

- Run the full local gate (`npm run check`) before proposing a commit.
- Obtain an independent review of the complete diff before committing.
- Commit only the reviewed scope; keep local-only material, archives, and generated output out of the release.