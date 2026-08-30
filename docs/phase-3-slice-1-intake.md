# Phase 3 — Slice 1: Structured client intake

Status: complete locally on 2026-08-30.

This is the first vertical slice in Phase 3, Prompt 4 of the 1-Day Vibe Coding System. It turns a client-accessible project in `INTAKE` into a production-ready project through one validated, immutable brief submission.

## Working flow

1. An owner or admin creates a project. The project is attached to the latest published, active intake-template version in the same workspace.
2. The associated client opens the project and sees the versioned brief definition.
3. The client completes the configured fields. Unknown answer keys are discarded and configured answers are normalized and validated on the server.
4. Submission atomically creates an immutable definition-and-answer snapshot, advances the project from `INTAKE` to `READY`, assigns the next submission sequence, and appends an `INTAKE_SUBMITTED` activity.
5. The submitted brief becomes read-only. The project can then be advanced from `READY` to `IN_PROGRESS` by an authorized workspace manager.

The previous generic project-status control can no longer bypass intake. Its compatibility endpoint permits only the explicit `READY` to `IN_PROGRESS` transition.

## UI contract

The project page now includes a responsive intake workspace between the project metrics and Files:

- A navy production-slate rail communicates the current step and makes the brief visually distinct from generic dashboard cards.
- Supported fields render from the stored definition: short text, long text, select, confirmation checkbox, and asset checklist.
- Loading, recoverable error, empty-template, editable, submitting, waiting, and immutable submitted states are represented.
- Required-field errors appear beside the relevant answer.
- Clients see a clear lock notice before sending the brief; non-client roles see the current brief without a client submission control.
- Stage labels use intentional sentence case, and the dashboard date and greeting reflect the current local date and time.

## Validation and authorization

- Definitions are versioned with `schemaVersion: 1`, unique field keys, and required options for select fields.
- Strings are trimmed and limited to 5,000 characters.
- Asset checklists accept no more than 50 non-empty entries, each limited to 255 characters.
- Select answers must match a configured option and required confirmations must be true.
- Only an authenticated `CLIENT` associated with the project can submit.
- Workspace, membership, assignment, and client constraints are applied through the existing server-side authorization query.
- Submission is refused unless the project is currently `INTAKE`, the attached template version is published, and no submitted brief already exists.

## API and data boundary

- `GET /api/projects/[id]/intake` returns the accessible project's canonical stage, validated template definition, latest submitted snapshot, and whether the current user may submit.
- `POST /api/projects/[id]/intake` accepts only `{ answers }`, performs server-side normalization, and returns field-specific validation errors where applicable.
- `POST /api/projects` requires owner/admin access and attaches the latest published active intake version in the same database transaction as the new client/project/activity records.
- Submitted definitions and answers are snapshots; later template edits cannot rewrite the historical brief.

The canonical development seed keeps one accessible `INTAKE` project for `client@demo.vidportal.test`: **Acme Product Launch**.

## Verification completed

- Manual read-only browser review of the authenticated client dashboard, intake project, full brief form, and responsive visual hierarchy.
- ESLint.
- Next.js route type generation and TypeScript.
- Prisma schema validation.
- Nine Vitest files with 54 passing tests, including definition-version enforcement, answer normalization, validation failures, role/authorization contracts, atomic lifecycle evidence, and prevention of the status-control bypass.
- Next.js production build with the complete 16-route application surface.
- Canonical seed and read-only database verifier after attaching the intake demonstration project to the seeded client.

The final live `POST` was intentionally not performed during verification because it would mutate the shared development seed. It remains an explicit, permission-gated smoke test rather than an unreported database change.

## Deferred work

- Owner/admin template-management screens and template publication workflow.
- Owner/admin intake reopening within the approved lifecycle window.
- Draft autosave and multi-session draft recovery.
- R2-backed asset uploads and upload recovery; the current Files area remains the prototype local-storage path.
- Provider-backed notifications and production email delivery.
- Full browser automation for the authenticated submit path using an isolated test database.
