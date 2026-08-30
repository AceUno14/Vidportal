-- Phase 2 foundation: Better Auth session cutover.
-- Existing prototype password hashes are intentionally replaced by Better Auth
-- credential Account records created by the canonical seed.

ALTER TABLE "user" DROP COLUMN "passwordHash";

ALTER TABLE "session" ADD COLUMN "activeWorkspaceId" TEXT;

CREATE INDEX "session_activeWorkspaceId_idx" ON "session"("activeWorkspaceId");

ALTER TABLE "session"
ADD CONSTRAINT "session_activeWorkspaceId_fkey"
FOREIGN KEY ("activeWorkspaceId") REFERENCES "Workspace"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
