import "dotenv/config";

import { PrismaNeon } from "@prisma/adapter-neon";
import { pathToFileURL } from "node:url";

import {
  Prisma,
  PrismaClient,
} from "../src/generated/prisma/client";

export const DEMO_IDS = {
  workspace: "demo_workspace_vidportal",
  users: {
    owner: "demo_user_owner",
    admin: "demo_user_admin",
    member: "demo_user_member",
    client: "demo_user_client",
  },
  memberships: {
    owner: "demo_membership_owner",
    admin: "demo_membership_admin",
    member: "demo_membership_member",
    client: "demo_membership_client",
  },
  clients: {
    acme: "demo_client_acme",
    brightline: "demo_client_brightline",
  },
  projects: {
    intake: "demo_project_intake",
    ready: "demo_project_ready",
    inProgress: "demo_project_in_progress",
    clientReview: "demo_project_client_review",
    revisions: "demo_project_revisions",
    finalDelivery: "demo_project_final_delivery",
    completed: "demo_project_completed",
  },
  assignments: {
    intake: "demo_assignment_intake",
    ready: "demo_assignment_ready",
    inProgress: "demo_assignment_in_progress",
    clientReview: "demo_assignment_client_review",
    revisions: "demo_assignment_revisions",
    finalDelivery: "demo_assignment_final_delivery",
    completed: "demo_assignment_completed",
  },
  intakeTemplate: "demo_intake_template_video",
  intakeTemplateVersion: "demo_intake_template_video_v1",
  intakeSubmission: "demo_intake_submission_ready_v1",
  fileAssets: {
    source: "demo_file_asset_source",
    final: "demo_file_asset_final",
  },
  uploadSession: "demo_upload_session_source",
  reviewVersions: {
    clientReview: "demo_review_client_review_v1",
    changesRequested: "demo_review_changes_requested_v1",
    approved: "demo_review_approved_v1",
    completed: "demo_review_completed_v1",
  },
  comments: {
    clientReview: "demo_comment_client_review",
    changesRequested: "demo_comment_changes_requested",
  },
  approvals: {
    changesRequested: "demo_approval_changes_requested",
    approved: "demo_approval_approved",
    completed: "demo_approval_completed",
  },
} as const;

const DEMO_TIMES = {
  workspace: new Date("2026-01-05T08:00:00.000Z"),
  identity: new Date("2026-01-05T08:05:00.000Z"),
  membership: new Date("2026-01-05T08:10:00.000Z"),
  client: new Date("2026-01-05T08:15:00.000Z"),
  intakeTemplate: new Date("2026-01-05T08:20:00.000Z"),
  intakeVersion: new Date("2026-01-05T08:25:00.000Z"),
  projects: new Date("2026-01-06T08:00:00.000Z"),
  submission: new Date("2026-01-07T08:00:00.000Z"),
  sourceUpload: new Date("2026-01-08T08:00:00.000Z"),
  sourceUploadComplete: new Date("2026-01-08T08:15:00.000Z"),
  sourceUploadExpiry: new Date("2026-01-09T08:00:00.000Z"),
  review: new Date("2026-01-09T08:00:00.000Z"),
  reviewReady: new Date("2026-01-09T08:30:00.000Z"),
  reviewSubmitted: new Date("2026-01-09T08:35:00.000Z"),
  reviewExpiry: new Date("2026-01-10T08:00:00.000Z"),
  decision: new Date("2026-01-10T08:00:00.000Z"),
  finalFile: new Date("2026-01-11T08:00:00.000Z"),
} as const;

const WORKSPACE = {
  id: DEMO_IDS.workspace,
  name: "Framecraft Studio",
  slug: "framecraft-demo",
  logoUrl: null,
  logoDarkUrl: null,
  primaryColor: "#F06E5B",
  accentColor: "#233876",
  archivedAt: null,
  createdAt: DEMO_TIMES.workspace,
  updatedAt: DEMO_TIMES.workspace,
} as const;

const USERS = [
  {
    id: DEMO_IDS.users.owner,
    name: "Olivia Owner",
    email: "owner@demo.vidportal.test",
    emailVerified: true,
    image: null,
  },
  {
    id: DEMO_IDS.users.admin,
    name: "Alex Admin",
    email: "admin@demo.vidportal.test",
    emailVerified: true,
    image: null,
  },
  {
    id: DEMO_IDS.users.member,
    name: "Morgan Editor",
    email: "editor@demo.vidportal.test",
    emailVerified: true,
    image: null,
  },
  {
    id: DEMO_IDS.users.client,
    name: "Casey Client",
    email: "client@demo.vidportal.test",
    emailVerified: true,
    image: null,
  },
] as const;

const CLIENTS = [
  {
    id: DEMO_IDS.clients.acme,
    workspaceId: DEMO_IDS.workspace,
    name: "Acme Marketing",
    email: "projects@acme.example.test",
    company: "Acme Marketing",
  },
  {
    id: DEMO_IDS.clients.brightline,
    workspaceId: DEMO_IDS.workspace,
    name: "Brightline Labs",
    email: "creative@brightline.example.test",
    company: "Brightline Labs",
  },
] as const;

const PROJECTS = [
  {
    id: DEMO_IDS.projects.intake,
    clientId: DEMO_IDS.clients.brightline,
    name: "Brightline Product Launch",
    description: "Waiting for the client to complete the structured brief.",
    type: "Product launch",
    status: "INTAKE",
    deliveryDate: new Date("2026-03-02T00:00:00.000Z"),
  },
  {
    id: DEMO_IDS.projects.ready,
    clientId: DEMO_IDS.clients.acme,
    name: "Acme Customer Story",
    description: "Intake is complete and production can begin.",
    type: "Customer story",
    status: "READY",
    deliveryDate: new Date("2026-02-23T00:00:00.000Z"),
  },
  {
    id: DEMO_IDS.projects.inProgress,
    clientId: DEMO_IDS.clients.acme,
    name: "Acme Social Campaign",
    description: "Source footage is being edited into campaign cutdowns.",
    type: "Social campaign",
    status: "IN_PROGRESS",
    deliveryDate: new Date("2026-02-16T00:00:00.000Z"),
  },
  {
    id: DEMO_IDS.projects.clientReview,
    clientId: DEMO_IDS.clients.acme,
    name: "Acme Founder Interview",
    description: "The first cut is awaiting timestamped client feedback.",
    type: "Interview",
    status: "CLIENT_REVIEW",
    deliveryDate: new Date("2026-02-09T00:00:00.000Z"),
  },
  {
    id: DEMO_IDS.projects.revisions,
    clientId: DEMO_IDS.clients.acme,
    name: "Acme Brand Film",
    description: "The client requested changes to the first review version.",
    type: "Brand film",
    status: "REVISIONS",
    deliveryDate: new Date("2026-02-12T00:00:00.000Z"),
  },
  {
    id: DEMO_IDS.projects.finalDelivery,
    clientId: DEMO_IDS.clients.acme,
    name: "Acme Event Recap",
    description: "The review is approved and final deliverables are being prepared.",
    type: "Event recap",
    status: "FINAL_DELIVERY",
    deliveryDate: new Date("2026-02-06T00:00:00.000Z"),
  },
  {
    id: DEMO_IDS.projects.completed,
    clientId: DEMO_IDS.clients.acme,
    name: "Acme Recruitment Film",
    description: "Approved final deliverables have been published.",
    type: "Recruitment film",
    status: "COMPLETED",
    deliveryDate: new Date("2026-01-30T00:00:00.000Z"),
  },
] as const;

const ASSIGNMENT_IDS = [
  DEMO_IDS.assignments.intake,
  DEMO_IDS.assignments.ready,
  DEMO_IDS.assignments.inProgress,
  DEMO_IDS.assignments.clientReview,
  DEMO_IDS.assignments.revisions,
  DEMO_IDS.assignments.finalDelivery,
  DEMO_IDS.assignments.completed,
] as const;

const INTAKE_DEFINITION = {
  schemaVersion: 1,
  fields: [
    {
      key: "targetAudience",
      label: "Target audience",
      type: "longText",
      required: true,
    },
    {
      key: "primaryGoal",
      label: "Primary goal",
      type: "longText",
      required: true,
    },
    {
      key: "requiredAssets",
      label: "Required assets",
      type: "fileChecklist",
      required: true,
    },
  ],
} satisfies Prisma.InputJsonValue;

const INTAKE_ANSWERS = {
  targetAudience: "Marketing leaders at growing B2B companies.",
  primaryGoal: "Show how Acme customers shorten campaign production time.",
  requiredAssets: ["brand-guidelines.pdf", "customer-interview.mov"],
} satisfies Prisma.InputJsonValue;

function requireDirectDatabaseUrl() {
  const value = process.env.DIRECT_URL;

  if (!value) {
    throw new Error("DIRECT_URL is required to seed the VidPortal database.");
  }

  const parsed = new URL(value);

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DIRECT_URL must be a PostgreSQL connection URL.");
  }

  return value;
}

export function createSeedClient() {
  return new PrismaClient({
    adapter: new PrismaNeon({ connectionString: requireDirectDatabaseUrl() }),
  });
}

export async function seedDatabase(prisma: PrismaClient) {
  await prisma.$transaction(async (transaction) => {
    await transaction.workspace.upsert({
      where: { id: WORKSPACE.id },
      create: WORKSPACE,
      update: WORKSPACE,
    });

    for (const user of USERS) {
      const data = {
        ...user,
        createdAt: DEMO_TIMES.identity,
        updatedAt: DEMO_TIMES.identity,
      };

      await transaction.user.upsert({
        where: { id: user.id },
        create: data,
        update: data,
      });
    }

    for (const client of CLIENTS) {
      const data = {
        ...client,
        archivedAt: null,
        createdAt: DEMO_TIMES.client,
        updatedAt: DEMO_TIMES.client,
      };

      await transaction.client.upsert({
        where: { id: client.id },
        create: data,
        update: data,
      });
    }

    const memberships = [
      {
        id: DEMO_IDS.memberships.owner,
        userId: DEMO_IDS.users.owner,
        clientId: null,
        role: "OWNER" as const,
      },
      {
        id: DEMO_IDS.memberships.admin,
        userId: DEMO_IDS.users.admin,
        clientId: null,
        role: "ADMIN" as const,
      },
      {
        id: DEMO_IDS.memberships.member,
        userId: DEMO_IDS.users.member,
        clientId: null,
        role: "MEMBER" as const,
      },
      {
        id: DEMO_IDS.memberships.client,
        userId: DEMO_IDS.users.client,
        clientId: DEMO_IDS.clients.acme,
        role: "CLIENT" as const,
      },
    ];

    for (const membership of memberships) {
      const data = {
        ...membership,
        workspaceId: DEMO_IDS.workspace,
        status: "ACTIVE" as const,
        joinedAt: DEMO_TIMES.membership,
        deactivatedAt: null,
        updatedAt: DEMO_TIMES.membership,
      };

      await transaction.membership.upsert({
        where: { id: membership.id },
        create: data,
        update: data,
      });
    }

    await transaction.intakeTemplate.upsert({
      where: { id: DEMO_IDS.intakeTemplate },
      create: {
        id: DEMO_IDS.intakeTemplate,
        workspaceId: DEMO_IDS.workspace,
        name: "Video project brief",
        projectType: "Video production",
        active: true,
        archivedAt: null,
        createdAt: DEMO_TIMES.intakeTemplate,
        updatedAt: DEMO_TIMES.intakeTemplate,
      },
      update: {
        workspaceId: DEMO_IDS.workspace,
        name: "Video project brief",
        projectType: "Video production",
        active: true,
        archivedAt: null,
        createdAt: DEMO_TIMES.intakeTemplate,
        updatedAt: DEMO_TIMES.intakeTemplate,
      },
    });

    await transaction.intakeTemplateVersion.upsert({
      where: { id: DEMO_IDS.intakeTemplateVersion },
      create: {
        id: DEMO_IDS.intakeTemplateVersion,
        workspaceId: DEMO_IDS.workspace,
        intakeTemplateId: DEMO_IDS.intakeTemplate,
        createdByMembershipId: DEMO_IDS.memberships.owner,
        version: 1,
        definition: INTAKE_DEFINITION,
        publishedAt: DEMO_TIMES.intakeVersion,
        createdAt: DEMO_TIMES.intakeVersion,
      },
      update: {
        workspaceId: DEMO_IDS.workspace,
        intakeTemplateId: DEMO_IDS.intakeTemplate,
        createdByMembershipId: DEMO_IDS.memberships.owner,
        version: 1,
        definition: INTAKE_DEFINITION,
        publishedAt: DEMO_TIMES.intakeVersion,
        createdAt: DEMO_TIMES.intakeVersion,
      },
    });

    for (const project of PROJECTS) {
      const data = {
        ...project,
        workspaceId: DEMO_IDS.workspace,
        intakeTemplateVersionId:
          project.id === DEMO_IDS.projects.ready
            ? DEMO_IDS.intakeTemplateVersion
            : null,
        archivedAt: null,
        createdAt: DEMO_TIMES.projects,
        updatedAt: DEMO_TIMES.projects,
      };

      await transaction.project.upsert({
        where: { id: project.id },
        create: data,
        update: data,
      });
    }

    for (const [index, project] of PROJECTS.entries()) {
      const data = {
        id: ASSIGNMENT_IDS[index],
        workspaceId: DEMO_IDS.workspace,
        projectId: project.id,
        membershipId: DEMO_IDS.memberships.member,
        assignedByMembershipId: DEMO_IDS.memberships.owner,
        active: true,
        createdAt: DEMO_TIMES.projects,
        updatedAt: DEMO_TIMES.projects,
        removedAt: null,
      };

      await transaction.projectAssignment.upsert({
        where: { id: data.id },
        create: data,
        update: data,
      });
    }

    await transaction.intakeSubmission.createMany({
      data: [
        {
          id: DEMO_IDS.intakeSubmission,
          workspaceId: DEMO_IDS.workspace,
          projectId: DEMO_IDS.projects.ready,
          intakeTemplateVersionId: DEMO_IDS.intakeTemplateVersion,
          status: "SUBMITTED",
          sequence: 1,
          definitionSnapshot: INTAKE_DEFINITION,
          answers: INTAKE_ANSWERS,
          submittedByMembershipId: DEMO_IDS.memberships.client,
          submittedAt: DEMO_TIMES.submission,
          reopenedFromId: null,
          createdAt: DEMO_TIMES.submission,
        },
      ],
      skipDuplicates: true,
    });

    await transaction.fileAsset.upsert({
      where: { id: DEMO_IDS.fileAssets.source },
      create: {
        id: DEMO_IDS.fileAssets.source,
        workspaceId: DEMO_IDS.workspace,
        projectId: DEMO_IDS.projects.inProgress,
        uploadedByMembershipId: DEMO_IDS.memberships.member,
        originalFilename: "interview-camera-a.mp4",
        storageKey:
          "workspaces/demo_workspace_vidportal/projects/demo_project_in_progress/source/interview-camera-a.mp4",
        contentType: "video/mp4",
        sizeBytes: 5_242_880n,
        kind: "VIDEO",
        purpose: "SOURCE",
        visibility: "INTERNAL",
        status: "READY",
        checksum: "demo-sha256-source-video",
        durationSeconds: 312.5,
        verifiedAt: DEMO_TIMES.sourceUploadComplete,
        publishedAt: null,
        archivedAt: null,
        deletedAt: null,
        purgeAfter: null,
        createdAt: DEMO_TIMES.sourceUpload,
        updatedAt: DEMO_TIMES.sourceUploadComplete,
      },
      update: {
        workspaceId: DEMO_IDS.workspace,
        projectId: DEMO_IDS.projects.inProgress,
        uploadedByMembershipId: DEMO_IDS.memberships.member,
        originalFilename: "interview-camera-a.mp4",
        storageKey:
          "workspaces/demo_workspace_vidportal/projects/demo_project_in_progress/source/interview-camera-a.mp4",
        contentType: "video/mp4",
        sizeBytes: 5_242_880n,
        kind: "VIDEO",
        purpose: "SOURCE",
        visibility: "INTERNAL",
        status: "READY",
        checksum: "demo-sha256-source-video",
        durationSeconds: 312.5,
        verifiedAt: DEMO_TIMES.sourceUploadComplete,
        publishedAt: null,
        archivedAt: null,
        deletedAt: null,
        purgeAfter: null,
        createdAt: DEMO_TIMES.sourceUpload,
        updatedAt: DEMO_TIMES.sourceUploadComplete,
      },
    });

    await transaction.uploadSession.upsert({
      where: { id: DEMO_IDS.uploadSession },
      create: {
        id: DEMO_IDS.uploadSession,
        workspaceId: DEMO_IDS.workspace,
        projectId: DEMO_IDS.projects.inProgress,
        uploadedByMembershipId: DEMO_IDS.memberships.member,
        fileAssetId: DEMO_IDS.fileAssets.source,
        expectedFilename: "interview-camera-a.mp4",
        expectedByteSize: 5_242_880n,
        expectedContentType: "video/mp4",
        storageKey:
          "workspaces/demo_workspace_vidportal/projects/demo_project_in_progress/source/interview-camera-a.mp4",
        providerUploadId: null,
        uploadType: "SINGLE_PART",
        status: "COMPLETED",
        expiresAt: DEMO_TIMES.sourceUploadExpiry,
        completedAt: DEMO_TIMES.sourceUploadComplete,
        createdAt: DEMO_TIMES.sourceUpload,
        updatedAt: DEMO_TIMES.sourceUploadComplete,
      },
      update: {
        workspaceId: DEMO_IDS.workspace,
        projectId: DEMO_IDS.projects.inProgress,
        uploadedByMembershipId: DEMO_IDS.memberships.member,
        fileAssetId: DEMO_IDS.fileAssets.source,
        expectedFilename: "interview-camera-a.mp4",
        expectedByteSize: 5_242_880n,
        expectedContentType: "video/mp4",
        storageKey:
          "workspaces/demo_workspace_vidportal/projects/demo_project_in_progress/source/interview-camera-a.mp4",
        providerUploadId: null,
        uploadType: "SINGLE_PART",
        status: "COMPLETED",
        expiresAt: DEMO_TIMES.sourceUploadExpiry,
        completedAt: DEMO_TIMES.sourceUploadComplete,
        createdAt: DEMO_TIMES.sourceUpload,
        updatedAt: DEMO_TIMES.sourceUploadComplete,
      },
    });

    const reviewVersions = [
      {
        id: DEMO_IDS.reviewVersions.clientReview,
        projectId: DEMO_IDS.projects.clientReview,
        streamUid: "demo_stream_client_review_v1",
        declaredFilename: "founder-interview-v1.mp4",
        declaredByteSize: 42_000_000n,
        durationSeconds: 122.4,
      },
      {
        id: DEMO_IDS.reviewVersions.changesRequested,
        projectId: DEMO_IDS.projects.revisions,
        streamUid: "demo_stream_changes_requested_v1",
        declaredFilename: "brand-film-v1.mp4",
        declaredByteSize: 84_000_000n,
        durationSeconds: 95.2,
      },
      {
        id: DEMO_IDS.reviewVersions.approved,
        projectId: DEMO_IDS.projects.finalDelivery,
        streamUid: "demo_stream_approved_v1",
        declaredFilename: "event-recap-v2.mp4",
        declaredByteSize: 68_000_000n,
        durationSeconds: 73.8,
      },
      {
        id: DEMO_IDS.reviewVersions.completed,
        projectId: DEMO_IDS.projects.completed,
        streamUid: "demo_stream_completed_v2",
        declaredFilename: "recruitment-film-v2.mp4",
        declaredByteSize: 91_000_000n,
        durationSeconds: 108.6,
      },
    ];

    for (const review of reviewVersions) {
      const data = {
        ...review,
        workspaceId: DEMO_IDS.workspace,
        version: review.id === DEMO_IDS.reviewVersions.clientReview ? 1 : 2,
        createdByMembershipId: DEMO_IDS.memberships.member,
        title: review.declaredFilename.replace(/\.mp4$/i, ""),
        declaredContentType: "video/mp4",
        maxDurationSeconds: 600,
        requiresSignedUrls: true,
        status: "SUBMITTED" as const,
        uploadExpiresAt: DEMO_TIMES.reviewExpiry,
        readyAt: DEMO_TIMES.reviewReady,
        submittedAt: DEMO_TIMES.reviewSubmitted,
        archivedAt: null,
        createdAt: DEMO_TIMES.review,
        updatedAt: DEMO_TIMES.reviewSubmitted,
      };

      await transaction.reviewVersion.upsert({
        where: { id: review.id },
        create: data,
        update: data,
      });
    }

    const comments = [
      {
        id: DEMO_IDS.comments.clientReview,
        projectId: DEMO_IDS.projects.clientReview,
        reviewVersionId: DEMO_IDS.reviewVersions.clientReview,
        body: "Could we hold this title card for another second?",
        timestampSeconds: 18.4,
      },
      {
        id: DEMO_IDS.comments.changesRequested,
        projectId: DEMO_IDS.projects.revisions,
        reviewVersionId: DEMO_IDS.reviewVersions.changesRequested,
        body: "Please replace this product shot with the newer angle.",
        timestampSeconds: 42.8,
      },
    ];

    for (const comment of comments) {
      const data = {
        ...comment,
        workspaceId: DEMO_IDS.workspace,
        authorMembershipId: DEMO_IDS.memberships.client,
        parentId: null,
        resolvedAt: null,
        resolvedByMembershipId: null,
        createdAt: DEMO_TIMES.reviewSubmitted,
        updatedAt: DEMO_TIMES.reviewSubmitted,
      };

      await transaction.comment.upsert({
        where: { id: comment.id },
        create: data,
        update: data,
      });
    }

    await transaction.approval.createMany({
      data: [
        {
          id: DEMO_IDS.approvals.changesRequested,
          workspaceId: DEMO_IDS.workspace,
          projectId: DEMO_IDS.projects.revisions,
          reviewVersionId: DEMO_IDS.reviewVersions.changesRequested,
          decidedByMembershipId: DEMO_IDS.memberships.client,
          decision: "CHANGES_REQUESTED",
          note: "Please address the timestamped product-shot comment.",
          createdAt: DEMO_TIMES.decision,
        },
        {
          id: DEMO_IDS.approvals.approved,
          workspaceId: DEMO_IDS.workspace,
          projectId: DEMO_IDS.projects.finalDelivery,
          reviewVersionId: DEMO_IDS.reviewVersions.approved,
          decidedByMembershipId: DEMO_IDS.memberships.client,
          decision: "APPROVED",
          note: "Approved for final delivery.",
          createdAt: DEMO_TIMES.decision,
        },
        {
          id: DEMO_IDS.approvals.completed,
          workspaceId: DEMO_IDS.workspace,
          projectId: DEMO_IDS.projects.completed,
          reviewVersionId: DEMO_IDS.reviewVersions.completed,
          decidedByMembershipId: DEMO_IDS.memberships.client,
          decision: "APPROVED",
          note: "Approved and delivered.",
          createdAt: DEMO_TIMES.decision,
        },
      ],
      skipDuplicates: true,
    });

    await transaction.fileAsset.upsert({
      where: { id: DEMO_IDS.fileAssets.final },
      create: {
        id: DEMO_IDS.fileAssets.final,
        workspaceId: DEMO_IDS.workspace,
        projectId: DEMO_IDS.projects.completed,
        uploadedByMembershipId: DEMO_IDS.memberships.member,
        originalFilename: "recruitment-film-master.mp4",
        storageKey:
          "workspaces/demo_workspace_vidportal/projects/demo_project_completed/final/recruitment-film-master.mp4",
        contentType: "video/mp4",
        sizeBytes: 250_000_000n,
        kind: "VIDEO",
        purpose: "FINAL_DELIVERABLE",
        visibility: "PUBLISHED",
        status: "READY",
        checksum: "demo-sha256-final-video",
        durationSeconds: 108.6,
        verifiedAt: DEMO_TIMES.finalFile,
        publishedAt: DEMO_TIMES.finalFile,
        archivedAt: null,
        deletedAt: null,
        purgeAfter: null,
        createdAt: DEMO_TIMES.finalFile,
        updatedAt: DEMO_TIMES.finalFile,
      },
      update: {
        workspaceId: DEMO_IDS.workspace,
        projectId: DEMO_IDS.projects.completed,
        uploadedByMembershipId: DEMO_IDS.memberships.member,
        originalFilename: "recruitment-film-master.mp4",
        storageKey:
          "workspaces/demo_workspace_vidportal/projects/demo_project_completed/final/recruitment-film-master.mp4",
        contentType: "video/mp4",
        sizeBytes: 250_000_000n,
        kind: "VIDEO",
        purpose: "FINAL_DELIVERABLE",
        visibility: "PUBLISHED",
        status: "READY",
        checksum: "demo-sha256-final-video",
        durationSeconds: 108.6,
        verifiedAt: DEMO_TIMES.finalFile,
        publishedAt: DEMO_TIMES.finalFile,
        archivedAt: null,
        deletedAt: null,
        purgeAfter: null,
        createdAt: DEMO_TIMES.finalFile,
        updatedAt: DEMO_TIMES.finalFile,
      },
    });

    const activities = [
      ...PROJECTS.map((project, index) => ({
        id: `demo_activity_project_${index + 1}`,
        projectId: project.id,
        action: "PROJECT_CREATED",
        entityType: "Project",
        entityId: project.id,
        metadata: { status: project.status } satisfies Prisma.InputJsonValue,
        createdAt: DEMO_TIMES.projects,
      })),
      {
        id: "demo_activity_intake_submitted",
        projectId: DEMO_IDS.projects.ready,
        action: "INTAKE_SUBMITTED",
        entityType: "IntakeSubmission",
        entityId: DEMO_IDS.intakeSubmission,
        metadata: { sequence: 1 } satisfies Prisma.InputJsonValue,
        createdAt: DEMO_TIMES.submission,
      },
      {
        id: "demo_activity_source_uploaded",
        projectId: DEMO_IDS.projects.inProgress,
        action: "FILE_READY",
        entityType: "FileAsset",
        entityId: DEMO_IDS.fileAssets.source,
        metadata: { purpose: "SOURCE" } satisfies Prisma.InputJsonValue,
        createdAt: DEMO_TIMES.sourceUploadComplete,
      },
      {
        id: "demo_activity_changes_requested",
        projectId: DEMO_IDS.projects.revisions,
        action: "CHANGES_REQUESTED",
        entityType: "Approval",
        entityId: DEMO_IDS.approvals.changesRequested,
        metadata: {
          reviewVersionId: DEMO_IDS.reviewVersions.changesRequested,
        } satisfies Prisma.InputJsonValue,
        createdAt: DEMO_TIMES.decision,
      },
      {
        id: "demo_activity_review_approved",
        projectId: DEMO_IDS.projects.finalDelivery,
        action: "REVIEW_APPROVED",
        entityType: "Approval",
        entityId: DEMO_IDS.approvals.approved,
        metadata: {
          reviewVersionId: DEMO_IDS.reviewVersions.approved,
        } satisfies Prisma.InputJsonValue,
        createdAt: DEMO_TIMES.decision,
      },
      {
        id: "demo_activity_final_published",
        projectId: DEMO_IDS.projects.completed,
        action: "FINAL_DELIVERABLE_PUBLISHED",
        entityType: "FileAsset",
        entityId: DEMO_IDS.fileAssets.final,
        metadata: { visibility: "PUBLISHED" } satisfies Prisma.InputJsonValue,
        createdAt: DEMO_TIMES.finalFile,
      },
    ];

    await transaction.activity.createMany({
      data: activities.map((activity) => ({
        ...activity,
        workspaceId: DEMO_IDS.workspace,
        actorMembershipId: DEMO_IDS.memberships.owner,
        clientVisible: [
          "INTAKE_SUBMITTED",
          "CHANGES_REQUESTED",
          "REVIEW_APPROVED",
          "FINAL_DELIVERABLE_PUBLISHED",
        ].includes(activity.action),
      })),
      skipDuplicates: true,
    });
  });
}

async function main() {
  const prisma = createSeedClient();

  try {
    await seedDatabase(prisma);
    console.log("Canonical VidPortal demo data seeded.");
  } finally {
    await prisma.$disconnect();
  }
}

const entryPoint = process.argv[1];

if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    console.error("VidPortal seed failed.", error);
    process.exitCode = 1;
  });
}
