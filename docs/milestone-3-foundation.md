# Milestone 3: Workspace Data Model and Canonical Seed

Status: COMPLETE
Recorded: 2026-08-30
Scope: Workspace-scoped Prisma data model, reset-only migration, Neon runtime adapter, canonical development seed, data verification, and temporary prototype compatibility.

Milestone 3 does not implement Better Auth, R2 storage, Cloudflare Stream review, Resend email, or the final authorization and workflow services.

## 1. Preconditions and migration safety

The former prototype database was approved as disposable after one export was created and verified:

- File: `backups/pre-milestone-3-2026-08-28.json.gz`
- Size: 938 bytes
- SHA-256: `E120AACBB79C8DF3CE5C547BE86215FA6EDAC19B9F46B8935E4966F8DD8EF9BE`
- Source: the confirmed Neon development database
- Recovery: the erased prototype records remain recoverable from the ignored local export

The destructive reset was run only after explicit approval. The Milestone 3 SQL migration carries a reset-only warning and must not be applied with `migrate deploy` to a populated or irreplaceable database.

## 2. Canonical workspace model

The schema now establishes `Workspace` as the tenant boundary and adds the relational foundation for:

- Users, workspace memberships, roles, and Better Auth-compatible account/session/verification tables.
- Clients, projects, and explicit member project assignments.
- Versioned intake templates and immutable intake submission snapshots.
- File assets and resumable upload sessions.
- Review versions, comments, client approval decisions, and append-only activity.

Tenant-owned records carry a workspace relationship, and the schema includes the supporting unique constraints, indexes, and foreign keys required for workspace-scoped access.

Migration file:

`prisma/migrations/20260830090000_milestone_3_workspace_model/migration.sql`

Migration inventory:

| Change | Count |
| --- | ---: |
| New tables | 14 |
| Supporting enums | 11 |
| Indexes | 64 |
| Foreign keys | 46 |
| Replaced prototype tables | 6 |

All three repository migrations are applied to the development database, and `prisma migrate status` reports the schema as current.

## 3. Neon runtime and CLI connections

- Application runtime uses `@prisma/adapter-neon` with the pooled `DATABASE_URL`.
- Prisma migration and administration commands use the direct `DIRECT_URL` from `prisma.config.ts`.
- Database environment parsing remains dependency-scoped and server-only.
- The former PostgreSQL driver SSL compatibility warning is no longer part of the runtime path.

No database credentials are committed. `.env.example` contains placeholders only, while real `.env*` files remain ignored.

## 4. Canonical seed and verification

`prisma/seed.ts` creates a deterministic, idempotent development dataset. It was run twice successfully after reset to verify that a repeat run does not duplicate records.

`prisma/verify.ts` checks the seeded row counts, tenant relationships, assignments, workflow examples, intake snapshot, file/upload state, review decisions, and activity evidence.

Verified canonical counts:

| Model | Rows |
| --- | ---: |
| Workspace | 1 |
| User | 4 |
| Membership | 4 |
| Client | 2 |
| Project | 7 |
| ProjectAssignment | 7 |
| IntakeTemplate | 1 |
| IntakeTemplateVersion | 1 |
| IntakeSubmission | 1 |
| FileAsset | 2 |
| UploadSession | 1 |
| ReviewVersion | 4 |
| Comment | 2 |
| Approval | 3 |
| Activity | 12 |

The seed intentionally creates no Better Auth account, session, or verification rows; each verified count is zero until Milestone 4 implements authentication.

## 5. Temporary prototype compatibility boundary

The existing UI and route surface remain usable while the database foundation changes underneath them:

- Temporary JWT claims now include workspace and membership context.
- Existing client and project routes scope queries to the authenticated workspace.
- `src/lib/prototype-compat.ts` maps canonical roles, project states, and file records to the legacy UI contract.
- A login with multiple active memberships currently selects the first membership. Workspace selection belongs to the Better Auth milestone.

These adapters are migration scaffolding, not the final application contract. In particular:

- Better Auth and the complete locked authorization matrix are not yet implemented.
- Legacy project status patching does not represent the final lifecycle transition service.
- Prototype uploads still use local disk, and the legacy delete route can remove a database row and local file immediately. This is not the locked R2 soft-delete and retention behavior.
- Final R2, Stream, approval, activity, and retention enforcement remains assigned to later feature milestones.

The compatibility routes must not be treated as production-ready authorization, storage, or lifecycle behavior.

## 6. Verification gate

Final local verification on 2026-08-30:

| Check | Result |
| --- | --- |
| `npm run lint` | Passed with zero errors or warnings. |
| `npm run typecheck` | Passed. |
| `npm run db:validate` | Passed; Prisma schema valid. |
| `npm test` | Passed: 5 test files, 37 tests. |
| `npm run build` | Passed; production build completed. |
| `npm run test:e2e -- tests/e2e/health.spec.ts` | Passed: 1 isolated request-only smoke test. |
| `npm run db:verify` | Passed with the canonical counts and relationship checks. |
| `prisma migrate status` | Passed; database schema is up to date. |

## 7. Milestone 3 completion gate

Milestone 3 is complete. The implementation satisfies the approved gate:

- The canonical workspace schema and reset-only SQL migration exist.
- The verified backup predates the approved development reset.
- Neon pooled runtime and direct CLI connections are separated.
- The canonical seed is deterministic and idempotent.
- Database verification and all local quality gates pass.
- Compatibility limitations and deferred production behavior are explicit.

The next implementation milestone is the Better Auth cutover. No Better Auth, R2, Stream, Resend, or deployment claim is included in this checkpoint.
