# VidPortal

VidPortal is a video-first project intake, review, feedback, and delivery portal for agencies, production houses, and freelancers.

The repository contains a working prototype on the canonical workspace-scoped Prisma model with a Neon runtime adapter and deterministic development seed. Milestones 1–3 are complete. Better Auth, R2 uploads, Stream review, and Resend email remain future milestones and are not claimed as complete.

## Local setup

Prerequisites:

- Node.js 22 or newer
- A Neon PostgreSQL development database

Create the local environment file and install dependencies:

```powershell
Copy-Item .env.example .env
npm ci
```

Configure Neon's pooled connection as `DATABASE_URL`, its direct connection as `DIRECT_URL`, and a temporary `JWT_SECRET` for the prototype routes. The remaining placeholders document the locked target environment and become active in their implementation milestones.

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

## Verification

```powershell
npm run check
npm run test:e2e -- tests/e2e/health.spec.ts
```

`npm run check` runs lint, TypeScript, Prisma validation, unit/integration tests, and a production build. The Playwright foundation smoke test starts or reuses the application server and verifies `/api/health` without requiring browser binaries.

## Current prototype routes

- `/`: agency dashboard and project creation
- `/login`: prototype login and signup
- `/clients`: client management
- `/projects/[id]`: project detail and prototype file management
- `/api/health`: service health
- `/api/auth/*`: temporary JWT authentication routes
- `/api/clients/*`: client routes
- `/api/projects/*`: project and file routes

## Architecture documentation

- `docs/milestone-1-foundation.md`: locked product rules and baseline
- `docs/milestone-2-foundation.md`: locked skeleton, configuration, tests, and CI
- `docs/milestone-3-foundation.md`: completed workspace data model, migration, seed, and verification
- `docs/architecture.md`: approved modular-monolith boundaries
- `docs/authorization.md`: tenant, role, and resource-access rules
- `docs/r2-cors.md`: mandatory browser-to-R2 CORS policy
- `docs/storage-lifecycle.md`: upload recovery, retention, and reconciliation

## Security notes

- Never commit `.env` files or provider credentials.
- `backups/` is ignored because local exports may contain sensitive prototype data.
- Uploaded project files must not be committed from `public/uploads/`.
- The temporary JWT implementation will be removed during the approved Better Auth milestone.
