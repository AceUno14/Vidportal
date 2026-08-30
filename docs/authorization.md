# VidPortal Authorization Model

- Status: Approved v1 policy
- Last updated: 2026-08-28

This document turns the locked [Milestone 1 role matrix](./milestone-1-foundation.md) into server-enforcement rules. It does not replace that matrix or define a new role system.

## 1. Security boundary

Every protected read and mutation is authorized on the server. UI visibility, route redirects, client-supplied role values, object keys, provider upload IDs, and unverified token claims are not authorization boundaries.

Authorization is evaluated in this order:

```text
valid server session
  -> active workspace membership
  -> allowed workspace role
  -> access to the specific resource
  -> allowed action in the resource's current state
```

A failure at any layer returns a safe response and performs no mutation. Prefer a generic not-found response when revealing the existence of a cross-workspace identifier would leak tenant information.

## 2. Identity, tenancy, and roles

`User` is a global identity. Access to a tenant is granted by an active `Membership` in a `Workspace`.

V1 has four fixed workspace roles:

- `OWNER`: the single workspace owner, with all workspace data access and ownership authority.
- `ADMIN`: workspace operations and branding authority, without ownership transfer or owner removal.
- `MEMBER`: internal worker with access only to explicitly assigned projects.
- `CLIENT`: external reviewer associated with one workspace `Client` record and its projects.

Role invariants:

- A workspace has exactly one owner.
- Admins cannot grant, transfer, or remove ownership.
- A member's workspace membership alone does not grant access to every project.
- A client membership must resolve to its associated workspace client record.
- Archived or inactive memberships grant no protected access.
- A user may eventually hold memberships in multiple workspaces; authorization always evaluates the membership for the current workspace.

## 3. Resource scoping

### Workspace

The route workspace slug is only a lookup key. After resolving it, all services use the canonical workspace ID from the database. A payload-provided workspace ID cannot broaden access.

Owner and admin can view all workspace projects and clients. Members and clients receive only the constrained views described below.

### Client record

- Owner/admin: create, edit, archive, and view every client record in the workspace.
- Member: view a client only through an assigned project that belongs to that client.
- Client: view only the client record associated with the membership.

A `Client` business record and a client user's identity are separate. Inviting a client user does not transfer ownership of the client record, and creating a record does not create a password or session.

### Project

- Owner/admin: access every project in the workspace.
- Member: access only when an active `ProjectAssignment` links that membership or user to the project.
- Client: access only when the project belongs to the `Client` record associated with that membership.

Project access is checked by a tenant-scoped database query. Fetching a project globally by ID and checking it later is discouraged because it makes cross-tenant mistakes easier.

### Intake

- Owner/admin manage templates and may reopen a submitted intake while its project is `INTAKE` or `READY`.
- The associated client submits intake for an accessible project.
- A valid completed submission automatically transitions `INTAKE` to `READY`.
- V1 has no manual intake-acceptance permission or step.
- Once production has begun, the submitted snapshot is preserved; later corrections do not overwrite it.

### File asset and upload session

Access requires access to the parent project plus the action and visibility rule.

- Owner/admin may authorize project uploads and abort any upload in the workspace.
- Assigned members may upload to assigned projects and abort their own uploads.
- Associated clients may upload client-provided source/reference assets and abort their own uploads.
- Only owner/admin may delete a ready asset in v1.
- Internal/source downloads are available to owner/admin and assigned members, not clients.
- A client may download only ready, published deliverables for an associated project.

The server creates storage keys and binds provider operations to `UploadSession`. A client-provided object key or provider upload ID never establishes access. Completion requires server-side metadata verification before readiness.

### Review version and comment

A review version inherits project access, then adds visibility and state requirements.

- Owner/admin and assigned members may upload and submit review versions.
- Clients cannot view drafts that are unpublished, unprocessed, or not submitted for review.
- Owner/admin, assigned members, and associated clients may comment on a visible review version.
- Owner/admin and assigned members may resolve comments; clients cannot resolve them in v1.
- Comment timestamps belong to a specific review version and must fall within that version's duration.

Private Stream playback authorization is issued only after these checks. Possession of a Stream video identifier alone grants nothing.

### Approval decision

Only an associated client may create `APPROVED` or `CHANGES_REQUESTED`, and only for a visible version currently in client review. Internal users cannot impersonate a client decision.

The decision is immutable and version-scoped. Creating it and transitioning the project are one domain operation:

```text
CHANGES_REQUESTED -> project enters REVISIONS
APPROVED          -> project enters FINAL_DELIVERY
```

Repeated requests are idempotent. An owner/admin publication bypass requires a reason and an `APPROVAL_BYPASSED` activity event; it never creates a false client approval.

### Final deliverable

- Owner/admin and assigned members may upload final deliverables.
- Only owner/admin may publish them.
- Publication normally requires an approved review version.
- Associated clients may see and download only ready, published deliverables.
- Owner/admin must unpublish or archive published deliverables before reopening an approved project.

### Activity

- Owner/admin: all workspace activity.
- Member: activity for assigned projects.
- Client: only client-safe activity for associated projects.

Client-safe activity must be selected by an explicit event policy. It is unsafe to fetch all project activity and merely hide fields in the browser.

## 4. Action summary

| Action | Owner | Admin | Assigned member | Associated client |
| --- | :---: | :---: | :---: | :---: |
| Manage ownership | Yes | No | No | No |
| Manage branding | Yes | Yes | No | No |
| Manage clients/projects/assignments | Yes | Yes | No | No |
| View project | All | All | Assigned only | Associated only |
| Submit intake | No | No | No | Yes |
| Reopen intake in `INTAKE`/`READY` | Yes | Yes | No | No |
| Upload client source/reference assets | Yes | Yes | Yes | Yes |
| Upload review versions | Yes | Yes | Yes | No |
| Comment on visible review version | Yes | Yes | Yes | Yes |
| Resolve comments | Yes | Yes | Yes | No |
| Approve/request changes | No | No | No | Yes |
| Upload final deliverable | Yes | Yes | Yes | No |
| Publish final deliverable | Yes | Yes | No | No |
| Download internal/source asset | Yes | Yes | Yes | No |
| Download published deliverable | Yes | Yes | Yes | Yes |

`Yes` for a member always means an assigned project. `Yes` for a client always means a project associated through that membership's client record. More specific lifecycle and visibility constraints still apply.

## 5. Enforcement responsibilities

Central server helpers should establish reusable facts such as:

- Require an authenticated session.
- Require active membership in a canonical workspace.
- Require one of the allowed fixed roles.
- Require access to a tenant-scoped project.
- Require ownership of an upload session when the matrix demands it.

Feature services then enforce stateful rules such as a valid project transition, visible review status, asset visibility, or eligible approval.

Each route or Server Action should follow this shape:

1. Read the server session.
2. Parse route parameters and input.
3. Resolve tenant-scoped access through an authorization helper or constrained service query.
4. Validate action-specific state inside the service.
5. Execute the mutation and activity event atomically where practical.
6. Return only the fields the caller may see.

Server Components that read protected data use the same authorization path. Optimistic proxy redirects improve navigation but do not remove these checks.

## 6. Denial and audit behavior

- `401 Unauthorized`: no valid authenticated session.
- `403 Forbidden`: the caller is authenticated but lacks a known permission when revealing that fact is safe.
- `404 Not Found`: the resource does not exist in the authorized tenant scope, including cross-tenant identifiers where concealment is appropriate.
- `409 Conflict`: the action is authorized but invalid for the current state or conflicts with an immutable/idempotent result.
- `422 Unprocessable Content`: the request is structurally valid but violates declared input policy.

Do not log cookies, passwords, reset or invitation tokens, presigned URLs, provider API tokens, or raw sensitive intake answers. Important allowed and denied security-sensitive mutations should include actor, workspace, resource, action, and outcome in structured server logs. Durable product activity is appended only for the approved activity taxonomy.

## 7. Required authorization tests

Every protected use case needs positive and negative coverage. At minimum, test:

- No session and inactive/removed membership.
- Correct role in the correct workspace.
- Valid identifier from a different workspace.
- Unassigned member versus assigned member.
- Client linked to another client record in the same workspace.
- Resource whose parent project is inaccessible.
- Draft/unprocessed review visibility.
- Internal versus client versus published asset visibility.
- Duplicate immutable decision and invalid lifecycle transition.
- Attempted owner-management action by an admin.
- Attempted ready-asset deletion or publication by a member/client.

Tests must assert both the safe response and absence of unauthorized database or provider mutations.
