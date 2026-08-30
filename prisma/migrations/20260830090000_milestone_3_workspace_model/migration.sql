-- VIDPORTAL MILESTONE 3: RESET-ONLY MIGRATION
-- This migration intentionally replaces the disposable prototype data model.
-- Do not apply it to a populated or irreplaceable database with migrate deploy.
-- Verify the approved pre-Milestone 3 backup, reset the development database,
-- then run the canonical idempotent seed and verification gates.

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'CLIENT');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "IntakeSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('SOURCE', 'REFERENCE', 'ATTACHMENT', 'FINAL_DELIVERABLE');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('INTERNAL', 'CLIENT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "FileAssetStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "UploadType" AS ENUM ('SINGLE_PART', 'MULTIPART');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('CREATED', 'UPLOADING', 'COMPLETING', 'VERIFYING', 'COMPLETED', 'ABORTED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReviewVersionStatus" AS ENUM ('AUTHORIZED', 'UPLOADING', 'PROCESSING', 'READY', 'SUBMITTED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- AlterEnum
BEGIN;
CREATE TYPE "ProjectStatus_new" AS ENUM ('INTAKE', 'READY', 'IN_PROGRESS', 'CLIENT_REVIEW', 'REVISIONS', 'FINAL_DELIVERY', 'COMPLETED');
ALTER TABLE "Project" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "status" TYPE "ProjectStatus_new" USING ("status"::text::"ProjectStatus_new");
ALTER TYPE "ProjectStatus" RENAME TO "ProjectStatus_old";
ALTER TYPE "ProjectStatus_new" RENAME TO "ProjectStatus";
DROP TYPE "ProjectStatus_old";
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'INTAKE';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FileKind" ADD VALUE 'AUDIO';
ALTER TYPE "FileKind" ADD VALUE 'ARCHIVE';

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Client" DROP CONSTRAINT "Client_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_clientId_fkey";

-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_projectId_fkey";

-- DropForeignKey
ALTER TABLE "IntakeForm" DROP CONSTRAINT "IntakeForm_agencyId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_userId_fkey";

-- DropIndex
DROP INDEX "Activity_agencyId_createdAt_idx";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "agencyId",
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "agencyId",
DROP COLUMN "budgetCents",
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "intakeTemplateVersionId" TEXT,
ADD COLUMN     "workspaceId" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'INTAKE';

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "authorId",
DROP COLUMN "resolved",
ADD COLUMN     "authorMembershipId" TEXT NOT NULL,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedByMembershipId" TEXT,
ADD COLUMN     "reviewVersionId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "agencyId",
DROP COLUMN "userId",
ADD COLUMN     "actorMembershipId" TEXT,
ADD COLUMN     "clientVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "workspaceId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Agency";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "File";

-- DropTable
DROP TABLE "Invoice";

-- DropTable
DROP TABLE "IntakeForm";

-- DropTable
DROP TABLE "Session";

-- DropEnum
DROP TYPE "Role";

-- DropEnum
DROP TYPE "InvoiceStatus";

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "logoDarkUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#f06e5b',
    "accentColor" TEXT NOT NULL DEFAULT '#1f2937',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "role" "MembershipRole" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "deactivatedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAssignment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "assignedByMembershipId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectType" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeTemplateVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "intakeTemplateId" TEXT NOT NULL,
    "createdByMembershipId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeSubmission" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "intakeTemplateVersionId" TEXT NOT NULL,
    "submittedByMembershipId" TEXT,
    "reopenedFromId" TEXT,
    "status" "IntakeSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "sequence" INTEGER NOT NULL,
    "definitionSnapshot" JSONB NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploadedByMembershipId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "kind" "FileKind" NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "visibility" "FileVisibility" NOT NULL DEFAULT 'INTERNAL',
    "status" "FileAssetStatus" NOT NULL DEFAULT 'PENDING',
    "checksum" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "verifiedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "purgeAfter" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "uploadedByMembershipId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "expectedFilename" TEXT NOT NULL,
    "expectedByteSize" BIGINT NOT NULL,
    "expectedContentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "providerUploadId" TEXT,
    "uploadType" "UploadType" NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'CREATED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "abortedAt" TIMESTAMP(3),
    "lastReconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewVersion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdByMembershipId" TEXT NOT NULL,
    "sourceFileAssetId" TEXT,
    "version" INTEGER NOT NULL,
    "title" TEXT,
    "streamUid" TEXT,
    "declaredFilename" TEXT NOT NULL,
    "declaredByteSize" BIGINT NOT NULL,
    "declaredContentType" TEXT NOT NULL,
    "maxDurationSeconds" INTEGER NOT NULL,
    "requiresSignedUrls" BOOLEAN NOT NULL DEFAULT true,
    "status" "ReviewVersionStatus" NOT NULL DEFAULT 'AUTHORIZED',
    "durationSeconds" DOUBLE PRECISION,
    "uploadExpiresAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewVersionId" TEXT NOT NULL,
    "decidedByMembershipId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "session"("expiresAt");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "verification_expiresAt_idx" ON "verification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_role_status_idx" ON "Membership"("workspaceId", "role", "status");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_clientId_idx" ON "Membership"("workspaceId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_workspaceId_id_key" ON "Membership"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "ProjectAssignment_workspaceId_membershipId_active_idx" ON "ProjectAssignment"("workspaceId", "membershipId", "active");

-- CreateIndex
CREATE INDEX "ProjectAssignment_workspaceId_projectId_active_idx" ON "ProjectAssignment"("workspaceId", "projectId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAssignment_workspaceId_projectId_membershipId_key" ON "ProjectAssignment"("workspaceId", "projectId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectAssignment_workspaceId_id_key" ON "ProjectAssignment"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "IntakeTemplate_workspaceId_active_archivedAt_idx" ON "IntakeTemplate"("workspaceId", "active", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeTemplate_workspaceId_id_key" ON "IntakeTemplate"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "IntakeTemplateVersion_workspaceId_intakeTemplateId_publishe_idx" ON "IntakeTemplateVersion"("workspaceId", "intakeTemplateId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeTemplateVersion_workspaceId_id_key" ON "IntakeTemplateVersion"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeTemplateVersion_workspaceId_intakeTemplateId_version_key" ON "IntakeTemplateVersion"("workspaceId", "intakeTemplateId", "version");

-- CreateIndex
CREATE INDEX "IntakeSubmission_workspaceId_projectId_submittedAt_idx" ON "IntakeSubmission"("workspaceId", "projectId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeSubmission_workspaceId_id_key" ON "IntakeSubmission"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeSubmission_workspaceId_projectId_id_key" ON "IntakeSubmission"("workspaceId", "projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeSubmission_workspaceId_projectId_sequence_key" ON "IntakeSubmission"("workspaceId", "projectId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");

-- CreateIndex
CREATE INDEX "FileAsset_workspaceId_projectId_status_idx" ON "FileAsset"("workspaceId", "projectId", "status");

-- CreateIndex
CREATE INDEX "FileAsset_workspaceId_projectId_visibility_status_idx" ON "FileAsset"("workspaceId", "projectId", "visibility", "status");

-- CreateIndex
CREATE INDEX "FileAsset_status_purgeAfter_idx" ON "FileAsset"("status", "purgeAfter");

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_workspaceId_id_key" ON "FileAsset"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_workspaceId_projectId_id_key" ON "FileAsset"("workspaceId", "projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "UploadSession_storageKey_key" ON "UploadSession"("storageKey");

-- CreateIndex
CREATE INDEX "UploadSession_status_expiresAt_idx" ON "UploadSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "UploadSession_workspaceId_projectId_status_idx" ON "UploadSession"("workspaceId", "projectId", "status");

-- CreateIndex
CREATE INDEX "UploadSession_workspaceId_uploadedByMembershipId_status_idx" ON "UploadSession"("workspaceId", "uploadedByMembershipId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UploadSession_workspaceId_id_key" ON "UploadSession"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "UploadSession_workspaceId_projectId_fileAssetId_key" ON "UploadSession"("workspaceId", "projectId", "fileAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "UploadSession_workspaceId_providerUploadId_key" ON "UploadSession"("workspaceId", "providerUploadId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewVersion_streamUid_key" ON "ReviewVersion"("streamUid");

-- CreateIndex
CREATE INDEX "ReviewVersion_workspaceId_projectId_status_idx" ON "ReviewVersion"("workspaceId", "projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewVersion_workspaceId_id_key" ON "ReviewVersion"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewVersion_workspaceId_projectId_id_key" ON "ReviewVersion"("workspaceId", "projectId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewVersion_workspaceId_projectId_version_key" ON "ReviewVersion"("workspaceId", "projectId", "version");

-- CreateIndex
CREATE INDEX "Approval_workspaceId_projectId_createdAt_idx" ON "Approval"("workspaceId", "projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_workspaceId_id_key" ON "Approval"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_workspaceId_reviewVersionId_key" ON "Approval"("workspaceId", "reviewVersionId");

-- CreateIndex
CREATE INDEX "Client_workspaceId_archivedAt_idx" ON "Client"("workspaceId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Client_workspaceId_id_key" ON "Client"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Client_workspaceId_email_key" ON "Client"("workspaceId", "email");

-- CreateIndex
CREATE INDEX "Project_workspaceId_status_archivedAt_idx" ON "Project"("workspaceId", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "Project_workspaceId_clientId_status_idx" ON "Project"("workspaceId", "clientId", "status");

-- CreateIndex
CREATE INDEX "Project_workspaceId_deliveryDate_idx" ON "Project"("workspaceId", "deliveryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Project_workspaceId_id_key" ON "Project"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "Comment_workspaceId_reviewVersionId_createdAt_idx" ON "Comment"("workspaceId", "reviewVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_workspaceId_reviewVersionId_resolvedAt_idx" ON "Comment"("workspaceId", "reviewVersionId", "resolvedAt");

-- CreateIndex
CREATE INDEX "Comment_workspaceId_projectId_createdAt_idx" ON "Comment"("workspaceId", "projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_workspaceId_id_key" ON "Comment"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Comment_workspaceId_reviewVersionId_id_key" ON "Comment"("workspaceId", "reviewVersionId", "id");

-- CreateIndex
CREATE INDEX "Activity_workspaceId_createdAt_idx" ON "Activity"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_workspaceId_projectId_createdAt_idx" ON "Activity"("workspaceId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_workspaceId_entityType_entityId_idx" ON "Activity"("workspaceId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_workspaceId_id_key" ON "Activity"("workspaceId", "id");

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_clientId_fkey" FOREIGN KEY ("workspaceId", "clientId") REFERENCES "Client"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_clientId_fkey" FOREIGN KEY ("workspaceId", "clientId") REFERENCES "Client"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_intakeTemplateVersionId_fkey" FOREIGN KEY ("workspaceId", "intakeTemplateVersionId") REFERENCES "IntakeTemplateVersion"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_workspaceId_projectId_fkey" FOREIGN KEY ("workspaceId", "projectId") REFERENCES "Project"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_workspaceId_membershipId_fkey" FOREIGN KEY ("workspaceId", "membershipId") REFERENCES "Membership"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_workspaceId_assignedByMembershipId_fkey" FOREIGN KEY ("workspaceId", "assignedByMembershipId") REFERENCES "Membership"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeTemplate" ADD CONSTRAINT "IntakeTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeTemplateVersion" ADD CONSTRAINT "IntakeTemplateVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeTemplateVersion" ADD CONSTRAINT "IntakeTemplateVersion_workspaceId_intakeTemplateId_fkey" FOREIGN KEY ("workspaceId", "intakeTemplateId") REFERENCES "IntakeTemplate"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeTemplateVersion" ADD CONSTRAINT "IntakeTemplateVersion_workspaceId_createdByMembershipId_fkey" FOREIGN KEY ("workspaceId", "createdByMembershipId") REFERENCES "Membership"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_workspaceId_projectId_fkey" FOREIGN KEY ("workspaceId", "projectId") REFERENCES "Project"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_workspaceId_intakeTemplateVersionId_fkey" FOREIGN KEY ("workspaceId", "intakeTemplateVersionId") REFERENCES "IntakeTemplateVersion"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_workspaceId_submittedByMembershipId_fkey" FOREIGN KEY ("workspaceId", "submittedByMembershipId") REFERENCES "Membership"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeSubmission" ADD CONSTRAINT "IntakeSubmission_workspaceId_projectId_reopenedFromId_fkey" FOREIGN KEY ("workspaceId", "projectId", "reopenedFromId") REFERENCES "IntakeSubmission"("workspaceId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_workspaceId_projectId_fkey" FOREIGN KEY ("workspaceId", "projectId") REFERENCES "Project"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_workspaceId_uploadedByMembershipId_fkey" FOREIGN KEY ("workspaceId", "uploadedByMembershipId") REFERENCES "Membership"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_workspaceId_projectId_fkey" FOREIGN KEY ("workspaceId", "projectId") REFERENCES "Project"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_workspaceId_uploadedByMembershipId_fkey" FOREIGN KEY ("workspaceId", "uploadedByMembershipId") REFERENCES "Membership"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_workspaceId_projectId_fileAssetId_fkey" FOREIGN KEY ("workspaceId", "projectId", "fileAssetId") REFERENCES "FileAsset"("workspaceId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVersion" ADD CONSTRAINT "ReviewVersion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVersion" ADD CONSTRAINT "ReviewVersion_workspaceId_projectId_fkey" FOREIGN KEY ("workspaceId", "projectId") REFERENCES "Project"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVersion" ADD CONSTRAINT "ReviewVersion_workspaceId_createdByMembershipId_fkey" FOREIGN KEY ("workspaceId", "createdByMembershipId") REFERENCES "Membership"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVersion" ADD CONSTRAINT "ReviewVersion_workspaceId_projectId_sourceFileAssetId_fkey" FOREIGN KEY ("workspaceId", "projectId", "sourceFileAssetId") REFERENCES "FileAsset"("workspaceId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workspaceId_projectId_fkey" FOREIGN KEY ("workspaceId", "projectId") REFERENCES "Project"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workspaceId_projectId_reviewVersionId_fkey" FOREIGN KEY ("workspaceId", "projectId", "reviewVersionId") REFERENCES "ReviewVersion"("workspaceId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workspaceId_authorMembershipId_fkey" FOREIGN KEY ("workspaceId", "authorMembershipId") REFERENCES "Membership"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workspaceId_resolvedByMembershipId_fkey" FOREIGN KEY ("workspaceId", "resolvedByMembershipId") REFERENCES "Membership"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_workspaceId_reviewVersionId_parentId_fkey" FOREIGN KEY ("workspaceId", "reviewVersionId", "parentId") REFERENCES "Comment"("workspaceId", "reviewVersionId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workspaceId_projectId_fkey" FOREIGN KEY ("workspaceId", "projectId") REFERENCES "Project"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workspaceId_projectId_reviewVersionId_fkey" FOREIGN KEY ("workspaceId", "projectId", "reviewVersionId") REFERENCES "ReviewVersion"("workspaceId", "projectId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workspaceId_decidedByMembershipId_fkey" FOREIGN KEY ("workspaceId", "decidedByMembershipId") REFERENCES "Membership"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workspaceId_projectId_fkey" FOREIGN KEY ("workspaceId", "projectId") REFERENCES "Project"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workspaceId_actorMembershipId_fkey" FOREIGN KEY ("workspaceId", "actorMembershipId") REFERENCES "Membership"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
