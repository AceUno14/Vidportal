import "server-only";

import { getR2StorageProvider } from "@/features/files/r2-provider";
import { FileServiceError } from "@/features/files/service";
import { prisma } from "@/lib/prisma";
import { isWorkspaceManager, projectWhereForAuth, type AuthUser } from "@/server/authorization";

async function requireProject(user: AuthUser, projectId: string) {
  const project = await prisma.project.findFirst({ where: { ...projectWhereForAuth(user, projectId), archivedAt: null }, select: { id: true } });
  if (!project) throw new FileServiceError("Project not found.", 404);
}

function serialize(review: { id: string; title: string | null; declaredFilename: string; status: string; version: number; createdAt: Date; sourceFileAssetId: string | null; comments: { id: string; body: string; timestampSeconds: number | null; createdAt: Date; author: { user: { name: string } } }[] }) {
  return { id: review.id, title: review.title ?? review.declaredFilename, filename: review.declaredFilename, status: review.status, version: review.version, createdAt: review.createdAt, sourceFileAssetId: review.sourceFileAssetId, canPlay: review.status === "READY" || review.status === "SUBMITTED", comments: review.comments.map((comment) => ({ id: comment.id, body: comment.body, timestampSeconds: comment.timestampSeconds, createdAt: comment.createdAt, author: comment.author.user.name })) };
}

const reviewInclude = { comments: { orderBy: { createdAt: "asc" as const }, include: { author: { include: { user: true } } } } };

export async function listProjectReviews(user: AuthUser, projectId: string) {
  await requireProject(user, projectId);
  const reviews = await prisma.reviewVersion.findMany({ where: { workspaceId: user.workspaceId, projectId, status: { in: ["READY", "SUBMITTED"] } }, orderBy: { version: "desc" }, include: reviewInclude });
  const videoFiles = isWorkspaceManager(user) ? await prisma.fileAsset.findMany({ where: { workspaceId: user.workspaceId, projectId, status: "READY", kind: "VIDEO" }, orderBy: { createdAt: "desc" }, select: { id: true, originalFilename: true } }) : [];
  return { reviews: reviews.map(serialize), videoFiles };
}

export async function createProjectReview(user: AuthUser, projectId: string, input: { fileAssetId: string; title?: string }) {
  if (!isWorkspaceManager(user)) throw new FileServiceError("Only workspace managers can publish a review version.", 403);
  await requireProject(user, projectId);
  const file = await prisma.fileAsset.findFirst({ where: { id: input.fileAssetId, workspaceId: user.workspaceId, projectId, status: "READY", kind: "VIDEO" } });
  if (!file) throw new FileServiceError("Choose a ready video file for review.", 422);
  const latest = await prisma.reviewVersion.aggregate({ where: { workspaceId: user.workspaceId, projectId }, _max: { version: true } });
  const review = await prisma.$transaction(async (transaction) => {
    const created = await transaction.reviewVersion.create({ data: { workspaceId: user.workspaceId, projectId, createdByMembershipId: user.membershipId, sourceFileAssetId: file.id, version: (latest._max.version ?? 0) + 1, title: input.title, declaredFilename: file.originalFilename, declaredByteSize: file.sizeBytes, declaredContentType: file.contentType, maxDurationSeconds: 600, status: "SUBMITTED", readyAt: new Date(), submittedAt: new Date() }, include: reviewInclude });
    await transaction.project.updateMany({ where: { id: projectId, workspaceId: user.workspaceId, status: { in: ["READY", "IN_PROGRESS", "REVISIONS"] } }, data: { status: "CLIENT_REVIEW" } });
    return created;
  });
  return serialize(review);
}

export async function getReviewPlayback(user: AuthUser, projectId: string, reviewId: string) {
  await requireProject(user, projectId);
  const review = await prisma.reviewVersion.findFirst({ where: { id: reviewId, workspaceId: user.workspaceId, projectId, status: { in: ["READY", "SUBMITTED"] } }, include: { sourceFileAsset: true } });
  if (!review?.sourceFileAsset || review.sourceFileAsset.status !== "READY") throw new FileServiceError("This review video is not available.", 404);
  const signed = await getR2StorageProvider().signDownload({ key: review.sourceFileAsset.storageKey, filename: review.sourceFileAsset.originalFilename, disposition: "inline" });
  return { url: signed.url, expiresAt: signed.expiresAt };
}

export async function addReviewComment(user: AuthUser, projectId: string, reviewId: string, input: { body: string; timestampSeconds?: number }) {
  await requireProject(user, projectId);
  const review = await prisma.reviewVersion.findFirst({ where: { id: reviewId, workspaceId: user.workspaceId, projectId, status: { in: ["READY", "SUBMITTED"] } } });
  if (!review) throw new FileServiceError("Review version not found.", 404);
  const comment = await prisma.comment.create({ data: { workspaceId: user.workspaceId, projectId, reviewVersionId: review.id, authorMembershipId: user.membershipId, body: input.body, timestampSeconds: input.timestampSeconds }, include: { author: { include: { user: true } } } });
  return { id: comment.id, body: comment.body, timestampSeconds: comment.timestampSeconds, createdAt: comment.createdAt, author: comment.author.user.name };
}

export async function decideReview(user: AuthUser, projectId: string, reviewId: string, input: { decision: "APPROVED" | "CHANGES_REQUESTED"; note?: string }) {
  if (user.role !== "CLIENT" || !user.clientId) throw new FileServiceError("Only the associated client can make this decision.", 403);
  await requireProject(user, projectId);
  return prisma.$transaction(async (transaction) => {
    const review = await transaction.reviewVersion.findFirst({ where: { id: reviewId, workspaceId: user.workspaceId, projectId, status: "SUBMITTED" } });
    if (!review) throw new FileServiceError("This review version is not available for a client decision.", 409);
    const prior = await transaction.approval.findUnique({ where: { workspaceId_reviewVersionId: { workspaceId: user.workspaceId, reviewVersionId: reviewId } } });
    if (prior) {
      if (prior.decision === input.decision) return { decision: prior.decision, idempotent: true };
      throw new FileServiceError("A decision has already been recorded for this version.", 409);
    }
    const targetStatus = input.decision === "APPROVED" ? "FINAL_DELIVERY" : "REVISIONS";
    const updated = await transaction.project.updateMany({ where: { id: projectId, workspaceId: user.workspaceId, status: "CLIENT_REVIEW" }, data: { status: targetStatus } });
    if (updated.count !== 1) throw new FileServiceError("This project is not awaiting a client decision.", 409);
    await transaction.approval.create({ data: { workspaceId: user.workspaceId, projectId, reviewVersionId: reviewId, decidedByMembershipId: user.membershipId, decision: input.decision, note: input.note || null } });
    await transaction.activity.create({ data: { workspaceId: user.workspaceId, projectId, actorMembershipId: user.membershipId, action: input.decision === "APPROVED" ? "REVIEW_APPROVED" : "CHANGES_REQUESTED", entityType: "ReviewVersion", entityId: reviewId, metadata: { decision: input.decision }, clientVisible: true } });
    return { decision: input.decision, idempotent: false };
  });
}
