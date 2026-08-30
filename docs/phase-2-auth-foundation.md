# Phase 2 — Authentication foundation

Status: complete locally on 2026-08-30.

This is Phase 2, Prompt 3 of the 1-Day Vibe Coding System. It is not a separate “Milestone 4.” The work replaces the prototype JWT boundary with Better Auth while preserving the canonical workspace and membership model established earlier in Phase 2.

## Implemented contract

- Better Auth 1.7.2 with the Prisma adapter and email/password credentials.
- Secure HTTP-only cookie sessions through `/api/auth/[...all]`.
- Public Better Auth signup disabled so a user cannot be created without a workspace membership.
- Workspace-aware owner signup through `/api/auth/signup`.
- Active workspace stored as nullable `Session.activeWorkspaceId`.
- Session creation selects the user's oldest active membership in a non-archived workspace and refuses a session when no valid membership exists.
- `/api/auth/context` exposes the canonical user, membership, active workspace, and available active memberships.
- `/api/auth/workspace` changes the active workspace only after validating an active membership.
- The dashboard, clients page, project page, and login page use cookie sessions. No bearer token or authentication identity is kept in `localStorage`.

VidPortal&apos;s `Workspace` and `Membership` records remain authoritative. Better Auth&apos;s organization and admin plugins are intentionally not used because their global role model would duplicate and conflict with workspace-scoped authorization.

## Authorization policy

| Role | Project visibility | Create projects/clients/logins | Change project status | Upload files | Delete files |
| --- | --- | --- | --- | --- | --- |
| OWNER | Entire active workspace | Yes | Yes | Yes | Yes |
| ADMIN | Entire active workspace | Yes | Yes | Yes | Yes |
| MEMBER | Active assignments only | No | Assigned projects only | Assigned projects only | No |
| CLIENT | Projects for associated client only | No | No | Associated-client projects only | No |

All protected API routes resolve the server session and active membership before querying resources. Workspace, assignment, and client constraints are applied in database queries so an unauthorized resource resolves as unavailable rather than leaking cross-tenant existence.

## Database change

Migration `20260830143000_better_auth_sessions` was applied to the configured Neon development database. It:

1. Removes the obsolete `user.passwordHash` column.
2. Adds nullable `session.activeWorkspaceId`.
3. Adds an index and a `Workspace` foreign key with `ON DELETE SET NULL`.

The canonical seed now creates four deterministic credential `Account` rows. It never seeds sessions or verification tokens. Two consecutive seed runs and the read-only verifier confirmed stable counts: four users, four memberships, four credential accounts, seven projects, and zero seeded sessions or verifications.

## Environment and deployment

Required authentication values:

- `BETTER_AUTH_SECRET`: at least 32 random characters; use a different secret for every deployed environment.
- `BETTER_AUTH_URL`: the exact trusted application origin.

Before a Netlify deployment, set both values in the relevant Netlify environment and use the canonical HTTPS site URL for `BETTER_AUTH_URL`. Preview deploys need an explicit origin strategy before authentication is tested there; the current configuration trusts one configured origin.

## Verification completed

- Prisma client generation and schema validation.
- ESLint.
- Next.js route type generation and TypeScript.
- Unit and contract tests, including role-scoped project filters and removal of browser-stored bearer tokens.
- Next.js production build with the complete 15-route Phase 2 surface.
- Migration deployment, two canonical seed runs, and database verification against the development Neon database.
- Live local smoke test of seeded-owner sign-in, authenticated workspace context, and sign-out; the temporary test session was removed afterward.

## Deferred work

- Password reset, email verification, invitation delivery, and credential rotation.
- A visible multi-workspace switcher using the completed `/api/auth/workspace` endpoint.
- Rate limiting and abuse controls for login and workspace signup.
- R2 direct uploads and recovery.
- Cloudflare Stream review flows.
- Resend transactional email.
- Replacement of the remaining prototype response adapters with canonical API shapes.
