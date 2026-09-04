# VidPortal

VidPortal is a video-first project intake, review, feedback, and delivery portal for agencies, production houses, and freelancers.

The repository contains a working v1 on the canonical workspace-scoped Prisma model with a Neon runtime adapter, Better Auth cookie sessions, a deterministic development seed, structured client intake, direct-to-R2 file transfer, private R2 review playback, timestamped client notes, review decisions, and guarded final delivery. The free deployment path uses the existing private R2 bucket for both review and delivery; Cloudflare Stream and transactional email are optional future enhancements, not runtime requirements.

## Local setup

Prerequisites:

- Node.js 22 or newer
- A Neon PostgreSQL development database

Create the local environment file and install dependencies:

```powershell
Copy-Item .env.example .env
npm ci
```

Configure Neon's pooled connection as `DATABASE_URL`, its direct connection as `DIRECT_URL`, and set `BETTER_AUTH_SECRET` to at least 32 random characters. Keep `BETTER_AUTH_URL` aligned with the application origin (`http://localhost:3000` locally and the canonical HTTPS origin in Netlify). Configure the private R2 bucket credentials for project files. `R2_STORAGE_QUOTA_BYTES` is optional and defaults to `8000000000` bytes.

Generate the client, apply migrations to a disposable development database, seed the canonical dataset, and verify it:

```powershell
npm run db:generate
npm run db:validate
npm run db:migrate
npm run db:seed
npm run db:verify
npm run dev
```

The Milestone 3 migration is reset-only for the former prototype model. Do not use a destructive reset against production or irreplaceable data. The current shared development database was reset only after its approved backup was verified.

Open `http://localhost:3000`.

The canonical development seed creates four Better Auth logins with the shared development-only password `VidPortalDemo123!`:

- `owner@demo.vidportal.test`
- `admin@demo.vidportal.test`
- `editor@demo.vidportal.test`
- `client@demo.vidportal.test`

Never reuse this password or the local development auth secret outside a disposable development environment.

## Verification

```powershell
npm run check
npm run test:e2e -- tests/e2e/health.spec.ts
```

`npm run check` runs lint, TypeScript, Prisma validation, unit/integration tests, and a production build. The Playwright foundation smoke test starts or reuses the application server and verifies `/api/health` without requiring browser binaries.

## Current prototype routes

- `/`: agency dashboard and project creation
- `/login`: Better Auth email/password login
- `/clients`: client management
- `/projects/[id]`: intake, secure file exchange, private review, decisions, and final delivery
- `/api/health`: service health
- `/api/auth/[...all]`: Better Auth handler
- `/api/auth/context`: current user, membership, and workspace context
- `/api/auth/workspace`: validated active-workspace switching
- `/api/auth/signup`: workspace-owner onboarding
- `/api/clients/*`: client routes
- `/api/projects/*`: project, intake, and file routes

## Architecture documentation

- `docs/milestone-1-foundation.md`: locked product rules and baseline
- `docs/milestone-2-foundation.md`: locked skeleton, configuration, tests, and CI
- `docs/milestone-3-foundation.md`: completed workspace data model, migration, seed, and verification
- `docs/phase-2-auth-foundation.md`: completed Better Auth and workspace authorization foundation
- `docs/phase-3-slice-1-intake.md`: completed structured client-intake vertical slice
- `docs/phase-3-slice-2-r2-files.md`: completed direct-to-R2 project-file slice, live acceptance, and storage guard
- `docs/phase-3-slice-3-review-decisions.md`: completed free R2 review, timestamped notes, and client decisions
- `docs/phase-3-slice-4-final-delivery.md`: completed final publication, client download, and project completion
- `docs/architecture.md`: approved modular-monolith boundaries
- `docs/authorization.md`: tenant, role, and resource-access rules
- `docs/r2-cors.md`: mandatory browser-to-R2 CORS policy
- `docs/storage-lifecycle.md`: upload recovery, retention, and reconciliation

## Security notes

- Never commit `.env` files or provider credentials.
- `backups/` is ignored because local exports may contain sensitive prototype data.
- Uploaded project files must not be committed from `public/uploads/`.
- Authentication uses secure HTTP-only Better Auth session cookies; bearer tokens are not stored in browser storage.
- Public Better Auth signup is disabled. VidPortal's workspace-aware signup route creates the user, credential account, workspace, and owner membership together.
