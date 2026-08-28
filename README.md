# VidPortal

Video-first client portal for production agencies. The current MVP includes a polished agency dashboard, login-ready UI, project search and status overview, project intake modal, a PostgreSQL Prisma schema, and initial API route contracts.

## Run locally

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database

Start PostgreSQL and set `DATABASE_URL` in `.env`, then run:

```powershell
npx prisma validate
npx prisma migrate dev --name init
npx prisma generate
```

Redis, S3/R2, Stripe, FFmpeg, and ClamAV are intentionally represented as environment boundaries in this first slice. They should be added behind service modules before production launch.

## API map

- `POST /api/auth/login` accepts `email` and `password` and returns a short-lived JWT-shaped access token in the MVP adapter.
- `GET /api/health` returns service health.
- `GET /api/projects` is the agency-scoped project listing boundary.
- `POST /api/projects` validates the minimum intake payload: `name` and `clientId`.

## Structure

- `src/app/page.tsx`: interactive dashboard and demo login experience
- `src/app/globals.css`: responsive visual system
- `src/app/api`: App Router API endpoints
- `src/lib/auth.ts`: JWT token helpers
- `prisma/schema.prisma`: agency, RBAC, project, file, feedback, invoice, intake, session, and audit models
- `.env.example`: local configuration template

## Production hardening still required

Connect the route handlers to Prisma, hash passwords with bcrypt, store refresh tokens in secure httpOnly cookies, add request schemas and rate limiting, scope every query by `agencyId`, add object-storage multipart uploads, and add email/Stripe/FFmpeg workers. The schema is designed to support those additions without changing the dashboard contract.
