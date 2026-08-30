import "dotenv/config";

import { PrismaNeon } from "@prisma/adapter-neon";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "../src/generated/prisma/client";
import { DEMO_IDS } from "./seed";

type Identified = { id: string };

const CANONICAL_WORKSPACE_ID = "demo_workspace_vidportal";

const EXPECTED_DEMO_COUNTS = {
  workspace: 1,
  user: 4,
  membership: 4,
  client: 2,
  project: 7,
  projectAssignment: 7,
  intakeTemplate: 1,
  intakeTemplateVersion: 1,
  intakeSubmission: 1,
  fileAsset: 2,
  uploadSession: 1,
  reviewVersion: 4,
  comment: 2,
  approval: 3,
  activity: 12,
} as const;

function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Canonical seed verification failed: ${message}`);
  }
}

function assertIds(label: string, rows: Identified[], expectedIds: string[]) {
  const actual = rows.map(({ id }) => id).sort();
  const expected = [...expectedIds].sort();

  invariant(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} IDs differ (expected ${expected.join(", ")}; received ${actual.join(", ")}).`,
  );
}

function requireDirectDatabaseUrl() {
  const value = process.env.DIRECT_URL;

  if (!value) {
    throw new Error("DIRECT_URL is required to verify the VidPortal database.");
  }

  const parsed = new URL(value);

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DIRECT_URL must be a PostgreSQL connection URL.");
  }

  return value;
}

export function createVerificationClient() {
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: requireDirectDatabaseUrl() }),
  });
}

export async function verifyCanonicalSeed(prisma: PrismaClient) {
  const demoId = { startsWith: "demo_" } as const;

  invariant(
    DEMO_IDS.workspace === CANONICAL_WORKSPACE_ID,
    "the seed and verifier disagree about the canonical workspace ID",
  );

  const [
    workspace,
    users,
    memberships,
    clients,
    projects,
    assignments,
    intakeTemplates,
    intakeTemplateVersions,
    intakeSubmissions,
    fileAssets,
    uploadSessions,
    reviewVersions,
    comments,
    approvals,
    activities,
    accountCount,
    sessionCount,
    verificationCount,
  ] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: DEMO_IDS.workspace },
      select: { id: true, slug: true, archivedAt: true },
    }),
    prisma.user.findMany({
      where: { id: demoId },
      select: { id: true, email: true },
    }),
    prisma.membership.findMany({
      where: { id: demoId },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        clientId: true,
        role: true,
        status: true,
      },
    }),
    prisma.client.findMany({
      where: { id: demoId },
      select: { id: true, workspaceId: true },
    }),
    prisma.project.findMany({
      where: { id: demoId },
      select: {
        id: true,
        workspaceId: true,
        clientId: true,
        status: true,
      },
    }),
    prisma.projectAssignment.findMany({
      where: { id: demoId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        membershipId: true,
        removedAt: true,
      },
    }),
    prisma.intakeTemplate.findMany({
      where: { id: demoId },
      select: { id: true, workspaceId: true },
    }),
    prisma.intakeTemplateVersion.findMany({
      where: { id: demoId },
      select: { id: true, workspaceId: true, intakeTemplateId: true, version: true },
    }),
    prisma.intakeSubmission.findMany({
      where: { id: demoId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        intakeTemplateVersionId: true,
        submittedByMembershipId: true,
        status: true,
        sequence: true,
        submittedAt: true,
      },
    }),
    prisma.fileAsset.findMany({
      where: { id: demoId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        uploadedByMembershipId: true,
        storageKey: true,
        originalFilename: true,
        contentType: true,
        sizeBytes: true,
        purpose: true,
        visibility: true,
        status: true,
      },
    }),
    prisma.uploadSession.findMany({
      where: { id: demoId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        uploadedByMembershipId: true,
        fileAssetId: true,
        storageKey: true,
        expectedFilename: true,
        expectedByteSize: true,
        expectedContentType: true,
        uploadType: true,
        status: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
    prisma.reviewVersion.findMany({
      where: { id: demoId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        createdByMembershipId: true,
        version: true,
        durationSeconds: true,
        status: true,
        requiresSignedUrls: true,
        submittedAt: true,
      },
    }),
    prisma.comment.findMany({
      where: { id: demoId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        reviewVersionId: true,
        authorMembershipId: true,
        timestampSeconds: true,
      },
    }),
    prisma.approval.findMany({
      where: { id: demoId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        reviewVersionId: true,
        decidedByMembershipId: true,
        decision: true,
      },
    }),
    prisma.activity.findMany({
      where: { id: demoId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        actorMembershipId: true,
      },
    }),
    prisma.account.count(),
    prisma.session.count(),
    prisma.verification.count(),
  ]);

  invariant(workspace, "the demo workspace is missing");
  invariant(workspace.slug === "framecraft-demo", "the workspace slug is not canonical");
  invariant(workspace.archivedAt === null, "the demo workspace is archived");

  assertIds("users", users, Object.values(DEMO_IDS.users));
  assertIds("memberships", memberships, Object.values(DEMO_IDS.memberships));
  assertIds("clients", clients, Object.values(DEMO_IDS.clients));
  assertIds("projects", projects, Object.values(DEMO_IDS.projects));
  assertIds("assignments", assignments, Object.values(DEMO_IDS.assignments));
  assertIds("intake templates", intakeTemplates, [DEMO_IDS.intakeTemplate]);
  assertIds("intake template versions", intakeTemplateVersions, [
    DEMO_IDS.intakeTemplateVersion,
  ]);
  assertIds("intake submissions", intakeSubmissions, [DEMO_IDS.intakeSubmission]);
  assertIds("file assets", fileAssets, Object.values(DEMO_IDS.fileAssets));
  assertIds("upload sessions", uploadSessions, [DEMO_IDS.uploadSession]);
  assertIds("review versions", reviewVersions, Object.values(DEMO_IDS.reviewVersions));
  assertIds("comments", comments, Object.values(DEMO_IDS.comments));
  assertIds("approvals", approvals, Object.values(DEMO_IDS.approvals));

  for (const [model, expectedCount] of Object.entries(EXPECTED_DEMO_COUNTS)) {
    const rows = {
      workspace: [workspace],
      user: users,
      membership: memberships,
      client: clients,
      project: projects,
      projectAssignment: assignments,
      intakeTemplate: intakeTemplates,
      intakeTemplateVersion: intakeTemplateVersions,
      intakeSubmission: intakeSubmissions,
      fileAsset: fileAssets,
      uploadSession: uploadSessions,
      reviewVersion: reviewVersions,
      comment: comments,
      approval: approvals,
      activity: activities,
    }[model];

    invariant(rows?.length === expectedCount, `${model} expected ${expectedCount} demo rows`);
  }

  invariant(
    accountCount === 0 && sessionCount === 0 && verificationCount === 0,
    "the canonical seed must not contain Better Auth account, session, or verification rows",
  );

  const membershipById = new Map(memberships.map((membership) => [membership.id, membership]));
  const ownerMemberships = memberships.filter(
    ({ role, status }) => role === "OWNER" && status === "ACTIVE",
  );
  const clientMembership = membershipById.get(DEMO_IDS.memberships.client);

  invariant(ownerMemberships.length === 1, "the demo workspace must have exactly one active owner");
  invariant(
    clientMembership?.role === "CLIENT" &&
      clientMembership.clientId === DEMO_IDS.clients.acme,
    "the client membership is not associated with the canonical client",
  );

  for (const membership of memberships) {
    invariant(
      membership.workspaceId === DEMO_IDS.workspace,
      `membership ${membership.id} crosses the workspace boundary`,
    );
  }

  for (const client of clients) {
    invariant(
      client.workspaceId === DEMO_IDS.workspace,
      `client ${client.id} crosses the workspace boundary`,
    );
  }

  const expectedStatuses = [
    "INTAKE",
    "READY",
    "IN_PROGRESS",
    "CLIENT_REVIEW",
    "REVISIONS",
    "FINAL_DELIVERY",
    "COMPLETED",
  ].sort();

  invariant(
    JSON.stringify(projects.map(({ status }) => status).sort()) ===
      JSON.stringify(expectedStatuses),
    "the demo projects do not cover the locked lifecycle",
  );

  const projectById = new Map(projects.map((project) => [project.id, project]));

  for (const assignment of assignments) {
    invariant(
      assignment.workspaceId === DEMO_IDS.workspace &&
        assignment.membershipId === DEMO_IDS.memberships.member &&
        assignment.removedAt === null,
      `assignment ${assignment.id} is inactive or crosses a tenant boundary`,
    );
    invariant(
      projectById.get(assignment.projectId)?.workspaceId === assignment.workspaceId,
      `assignment ${assignment.id} references a project in another workspace`,
    );
  }

  const submission = intakeSubmissions[0];
  invariant(
    submission?.status === "SUBMITTED" && submission.submittedAt,
    "the canonical intake submission is not submitted",
  );
  invariant(
    projectById.get(submission.projectId)?.status === "READY",
    "the submitted intake project is not READY",
  );
  invariant(
    submission.submittedByMembershipId === DEMO_IDS.memberships.client,
    "the intake submission was not attributed to the client membership",
  );

  const sourceAsset = fileAssets.find(({ id }) => id === DEMO_IDS.fileAssets.source);
  const finalAsset = fileAssets.find(({ id }) => id === DEMO_IDS.fileAssets.final);
  const uploadSession = uploadSessions[0];

  invariant(sourceAsset && uploadSession, "source file/upload metadata is missing");
  invariant(
    uploadSession.fileAssetId === sourceAsset.id &&
      uploadSession.workspaceId === sourceAsset.workspaceId &&
      uploadSession.projectId === sourceAsset.projectId &&
      uploadSession.uploadedByMembershipId === sourceAsset.uploadedByMembershipId &&
      uploadSession.storageKey === sourceAsset.storageKey &&
      uploadSession.expectedFilename === sourceAsset.originalFilename &&
      uploadSession.expectedByteSize === sourceAsset.sizeBytes &&
      uploadSession.expectedContentType === sourceAsset.contentType,
    "the upload session does not match its authorized file metadata",
  );
  invariant(
    uploadSession.uploadType === "SINGLE_PART" && uploadSession.status === "COMPLETED",
    "the canonical upload session is not a completed single-part upload",
  );
  invariant(
    uploadSession.expiresAt > uploadSession.createdAt,
    "the upload session does not expire after creation",
  );
  invariant(
    finalAsset?.purpose === "FINAL_DELIVERABLE" &&
      finalAsset.visibility === "PUBLISHED" &&
      finalAsset.status === "READY",
    "the completed project lacks a ready published final deliverable",
  );

  const reviewById = new Map(reviewVersions.map((review) => [review.id, review]));

  for (const review of reviewVersions) {
    invariant(
      review.workspaceId === DEMO_IDS.workspace &&
        review.createdByMembershipId === DEMO_IDS.memberships.member &&
        review.status === "SUBMITTED" &&
        review.requiresSignedUrls &&
        review.submittedAt,
      `review version ${review.id} is not a private submitted demo review`,
    );
    invariant(
      projectById.get(review.projectId)?.workspaceId === review.workspaceId,
      `review version ${review.id} crosses a tenant boundary`,
    );
  }

  for (const comment of comments) {
    const review = reviewById.get(comment.reviewVersionId);

    invariant(review, `comment ${comment.id} references a missing review version`);
    invariant(
      comment.workspaceId === review.workspaceId && comment.projectId === review.projectId,
      `comment ${comment.id} crosses its review-version tenant chain`,
    );
    invariant(
      comment.timestampSeconds === null ||
        (comment.timestampSeconds >= 0 &&
          review.durationSeconds !== null &&
          comment.timestampSeconds <= review.durationSeconds),
      `comment ${comment.id} has an invalid timestamp`,
    );
  }

  const expectedDecisions = new Map<string, readonly [string, string]>([
    [DEMO_IDS.reviewVersions.changesRequested, ["CHANGES_REQUESTED", "REVISIONS"]],
    [DEMO_IDS.reviewVersions.approved, ["APPROVED", "FINAL_DELIVERY"]],
    [DEMO_IDS.reviewVersions.completed, ["APPROVED", "COMPLETED"]],
  ]);

  for (const approval of approvals) {
    const review = reviewById.get(approval.reviewVersionId);
    const project = projectById.get(approval.projectId);
    const expected = expectedDecisions.get(approval.reviewVersionId);

    invariant(review && project && expected, `approval ${approval.id} has an invalid parent chain`);
    invariant(
      approval.workspaceId === review.workspaceId &&
        approval.projectId === review.projectId &&
        approval.decidedByMembershipId === DEMO_IDS.memberships.client,
      `approval ${approval.id} crosses its client/review tenant chain`,
    );
    invariant(
      approval.decision === expected[0] && project.status === expected[1],
      `approval ${approval.id} does not match its project workflow state`,
    );
  }

  for (const activity of activities) {
    invariant(
      activity.workspaceId === DEMO_IDS.workspace &&
        activity.actorMembershipId === DEMO_IDS.memberships.owner,
      `activity ${activity.id} crosses its workspace actor boundary`,
    );
    invariant(
      activity.projectId === null || projectById.has(activity.projectId),
      `activity ${activity.id} references a non-demo project`,
    );
  }

  return {
    workspaceId: workspace.id,
    counts: EXPECTED_DEMO_COUNTS,
    authRows: {
      accounts: accountCount,
      sessions: sessionCount,
      verifications: verificationCount,
    },
  };
}

async function main() {
  const prisma = createVerificationClient();

  try {
    const result = await verifyCanonicalSeed(prisma);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    console.error("VidPortal database verification failed.", error);
    process.exitCode = 1;
  });
}
