import "server-only";

import { randomUUID } from "node:crypto";

import type {
  Prisma,
  UploadStatus,
} from "@/generated/prisma/client";
import {
  allowedUploadPurposes,
  buildStorageKey,
  canDownloadAsset,
} from "@/features/files/policy";
import type { FileStorageProvider } from "@/features/files/provider";
import { getR2StorageProvider } from "@/features/files/r2-provider";
import {
  kindFromContentType,
  maximumPartNumber,
  multipartPartSize,
  uploadTypeForSize,
  type InitiateUploadInput,
} from "@/features/files/schema";
import {
  canReserveStorage,
  createStorageQuotaSnapshot,
} from "@/features/files/quota";
import { getR2StorageQuotaEnvironment } from "@/lib/env/server";
import { prisma } from "@/lib/prisma";
import {
  isWorkspaceManager,
  projectWhereForAuth,
  type AuthUser,
} from "@/server/authorization";

const UPLOAD_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const MAX_ACTIVE_UPLOADS_PER_MEMBER = 5;
const STORAGE_QUOTA_LOCK_KEY = 86_421_907;
const ACTIVE_UPLOAD_STATUSES: UploadStatus[] = [
  "CREATED",
  "UPLOADING",
  "COMPLETING",
  "VERIFYING",
];
const STORAGE_ACCOUNTING_WHERE: Prisma.FileAssetWhereInput = {
  status: { in: ["PENDING", "READY", "ARCHIVED", "DELETED"] },
};

type SafeAsset = Prisma.FileAssetGetPayload<{
  include: {
    uploadedBy: { select: { user: { select: { name: true } } } };
    uploadSession: {
      select: { id: true; uploadType: true; status: true; expiresAt: true };
    };
  };
}>;

export class FileServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "FileServiceError";
  }
}

function configuredStorage(storage?: FileStorageProvider) {
  if (storage) return storage;

  try {
    return getR2StorageProvider();
  } catch {
    throw new FileServiceError(
      "Cloud storage is not configured for this environment.",
      503,
    );
  }
}

function configuredStorageQuotaBytes() {
  try {
    return getR2StorageQuotaEnvironment().R2_STORAGE_QUOTA_BYTES;
  } catch {
    throw new FileServiceError(
      "The storage guard is not configured correctly.",
      503,
    );
  }
}

async function readStorageQuota() {
  const quotaBytes = configuredStorageQuotaBytes();
  const aggregate = await prisma.fileAsset.aggregate({
    where: STORAGE_ACCOUNTING_WHERE,
    _sum: { sizeBytes: true },
  });

  return createStorageQuotaSnapshot(
    aggregate._sum.sizeBytes ?? 0n,
    quotaBytes,
  );
}

async function storageOperation<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof FileServiceError) throw error;
    throw new FileServiceError(
      "Cloud storage could not complete this request. Retry in a moment.",
      503,
    );
  }
}

function serializeAsset(asset: SafeAsset, authUser: AuthUser) {
  const manager = isWorkspaceManager(authUser);
  const activeUpload =
    asset.uploadSession &&
    ACTIVE_UPLOAD_STATUSES.includes(asset.uploadSession.status)
      ? asset.uploadSession
      : null;

  return {
    id: asset.id,
    name: asset.originalFilename,
    contentType: asset.contentType,
    sizeBytes: asset.sizeBytes.toString(),
    kind: asset.kind,
    purpose: asset.purpose,
    visibility: asset.visibility,
    status: asset.status,
    verifiedAt: asset.verifiedAt,
    createdAt: asset.createdAt,
    uploadedBy: asset.uploadedBy.user.name,
    canDownload: canDownloadAsset(authUser.role, asset),
    canRemove: manager && asset.status === "READY",
    upload:
      activeUpload &&
      (manager || asset.uploadedByMembershipId === authUser.membershipId)
        ? {
            id: activeUpload.id,
            type: activeUpload.uploadType,
            status: activeUpload.status,
            expiresAt: activeUpload.expiresAt,
            canAbort:
              manager ||
              asset.uploadedByMembershipId === authUser.membershipId,
          }
        : null,
  };
}

function assetVisibilityWhere(
  authUser: AuthUser,
): Prisma.FileAssetWhereInput {
  if (authUser.role !== "CLIENT") {
    return { status: { notIn: ["DELETED", "ARCHIVED"] } };
  }

  return {
    OR: [
      {
        status: "READY",
        visibility: "PUBLISHED",
        purpose: "FINAL_DELIVERABLE",
      },
      {
        uploadedByMembershipId: authUser.membershipId,
        purpose: { in: ["SOURCE", "REFERENCE"] },
        status: { notIn: ["DELETED", "ARCHIVED"] },
      },
    ],
  };
}

async function requireProject(authUser: AuthUser, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { ...projectWhereForAuth(authUser, projectId), archivedAt: null },
    select: { id: true, status: true },
  });

  if (!project) {
    throw new FileServiceError("Project not found.", 404);
  }

  return project;
}

export async function listProjectFiles(authUser: AuthUser, projectId: string) {
  const project = await requireProject(authUser, projectId);

  const [assets, storage] = await Promise.all([
    prisma.fileAsset.findMany({
      where: {
        workspaceId: authUser.workspaceId,
        projectId,
        ...assetVisibilityWhere(authUser),
      },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { user: { select: { name: true } } } },
        uploadSession: {
          select: { id: true, uploadType: true, status: true, expiresAt: true },
        },
      },
    }),
    readStorageQuota(),
  ]);
  const projectLocked = project.status === "COMPLETED";
  const storageFull = storage.remainingBytes === "0";

  return {
    files: assets.map((asset) => serializeAsset(asset, authUser)),
    uploadPurposes: allowedUploadPurposes(authUser.role),
    canUpload: !projectLocked && !storageFull,
    uploadBlockReason: projectLocked
      ? ("PROJECT_COMPLETED" as const)
      : storageFull
        ? ("STORAGE_FULL" as const)
        : null,
    storage,
  };
}

async function markUploadFailed(uploadSessionId: string, fileAssetId: string) {
  await prisma.$transaction([
    prisma.uploadSession.updateMany({
      where: { id: uploadSessionId, status: { in: ACTIVE_UPLOAD_STATUSES } },
      data: { status: "FAILED" },
    }),
    prisma.fileAsset.updateMany({
      where: { id: fileAssetId, status: "PENDING" },
      data: { status: "FAILED" },
    }),
  ]);
}

export async function initiateProjectUpload(
  authUser: AuthUser,
  projectId: string,
  input: InitiateUploadInput,
  storage?: FileStorageProvider,
) {
  const project = await requireProject(authUser, projectId);
  const provider = configuredStorage(storage);
  const storageQuotaBytes = configuredStorageQuotaBytes();

  if (project.status === "COMPLETED") {
    throw new FileServiceError(
      "Completed projects are locked for new uploads.",
      409,
    );
  }

  if (!allowedUploadPurposes(authUser.role).includes(input.purpose)) {
    throw new FileServiceError(
      "This file purpose is not available for your role.",
      403,
    );
  }

  const activeUploads = await prisma.uploadSession.count({
    where: {
      workspaceId: authUser.workspaceId,
      uploadedByMembershipId: authUser.membershipId,
      status: { in: ACTIVE_UPLOAD_STATUSES },
      expiresAt: { gt: new Date() },
    },
  });

  if (activeUploads >= MAX_ACTIVE_UPLOADS_PER_MEMBER) {
    throw new FileServiceError(
      "Finish or cancel an active transfer before starting another.",
      429,
    );
  }

  const fileAssetId = randomUUID();
  const uploadSessionId = randomUUID();
  const uploadType = uploadTypeForSize(input.byteSize);
  const storageKey = buildStorageKey({
    workspaceId: authUser.workspaceId,
    projectId,
    purpose: input.purpose,
    fileAssetId,
  });
  const expiresAt = new Date(Date.now() + UPLOAD_SESSION_LIFETIME_MS);

  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(${STORAGE_QUOTA_LOCK_KEY})`;
    const aggregate = await transaction.fileAsset.aggregate({
      where: STORAGE_ACCOUNTING_WHERE,
      _sum: { sizeBytes: true },
    });
    const quota = createStorageQuotaSnapshot(
      aggregate._sum.sizeBytes ?? 0n,
      storageQuotaBytes,
    );

    if (!canReserveStorage(quota, input.byteSize)) {
      const remainingGb = (Number(quota.remainingBytes) / 1_000_000_000).toFixed(
        2,
      );
      throw new FileServiceError(
        `This file exceeds the storage guard. ${remainingGb} GB remains.`,
        413,
        {
          byteSize: "Choose a smaller file or clear retained storage first.",
        },
      );
    }

    await transaction.fileAsset.create({
      data: {
        id: fileAssetId,
        workspaceId: authUser.workspaceId,
        projectId,
        uploadedByMembershipId: authUser.membershipId,
        originalFilename: input.filename,
        storageKey,
        contentType: input.contentType,
        sizeBytes: BigInt(input.byteSize),
        kind: kindFromContentType(input.contentType),
        purpose: input.purpose,
        visibility: "INTERNAL",
        status: "PENDING",
      },
    });
    await transaction.uploadSession.create({
      data: {
        id: uploadSessionId,
        workspaceId: authUser.workspaceId,
        projectId,
        uploadedByMembershipId: authUser.membershipId,
        fileAssetId,
        expectedFilename: input.filename,
        expectedByteSize: BigInt(input.byteSize),
        expectedContentType: input.contentType,
        storageKey,
        uploadType,
        status: "CREATED",
        expiresAt,
      },
    });
  });

  try {
    if (uploadType === "SINGLE_PART") {
      const signed = await provider.signSinglePartUpload({
        key: storageKey,
        contentType: input.contentType,
      });
      await prisma.uploadSession.update({
        where: { id: uploadSessionId },
        data: { status: "UPLOADING" },
      });
      return {
        fileAssetId,
        uploadSessionId,
        uploadType,
        uploadUrl: signed.url,
        signedUrlExpiresAt: signed.expiresAt,
        sessionExpiresAt: expiresAt,
        partSize: null,
      };
    }

    const multipart = await provider.createMultipartUpload({
      key: storageKey,
      contentType: input.contentType,
    });
    await prisma.uploadSession.update({
      where: { id: uploadSessionId },
      data: {
        providerUploadId: multipart.providerUploadId,
        status: "UPLOADING",
      },
    });
    return {
      fileAssetId,
      uploadSessionId,
      uploadType,
      uploadUrl: null,
      signedUrlExpiresAt: null,
      sessionExpiresAt: expiresAt,
      partSize: multipartPartSize(input.byteSize),
    };
  } catch {
    await markUploadFailed(uploadSessionId, fileAssetId);
    throw new FileServiceError(
      "Cloud storage is unavailable. The transfer was not started.",
      503,
    );
  }
}

async function getUpload(
  authUser: AuthUser,
  projectId: string,
  uploadSessionId: string,
) {
  await requireProject(authUser, projectId);
  const upload = await prisma.uploadSession.findFirst({
    where: {
      id: uploadSessionId,
      workspaceId: authUser.workspaceId,
      projectId,
    },
    include: { fileAsset: true },
  });

  if (!upload) {
    throw new FileServiceError("Upload not found.", 404);
  }

  if (
    !isWorkspaceManager(authUser) &&
    upload.uploadedByMembershipId !== authUser.membershipId
  ) {
    throw new FileServiceError("Upload not found.", 404);
  }

  if (
    upload.expiresAt <= new Date() &&
    ACTIVE_UPLOAD_STATUSES.includes(upload.status)
  ) {
    await prisma.$transaction([
      prisma.uploadSession.update({
        where: { id: upload.id },
        data: { status: "EXPIRED" },
      }),
      prisma.fileAsset.updateMany({
        where: { id: upload.fileAssetId, status: "PENDING" },
        data: { status: "FAILED" },
      }),
    ]);
    throw new FileServiceError(
      "This transfer expired. Start a new upload.",
      410,
    );
  }

  return upload;
}

function requireTransferStatus(status: UploadStatus) {
  if (!ACTIVE_UPLOAD_STATUSES.includes(status)) {
    throw new FileServiceError(
      "This transfer is no longer accepting changes.",
      409,
    );
  }
}

export async function signProjectUploadPart(
  authUser: AuthUser,
  projectId: string,
  uploadSessionId: string,
  partNumber: number,
  storage?: FileStorageProvider,
) {
  const upload = await getUpload(authUser, projectId, uploadSessionId);
  const provider = configuredStorage(storage);
  requireTransferStatus(upload.status);

  if (upload.uploadType !== "MULTIPART" || !upload.providerUploadId) {
    throw new FileServiceError("This is not a multipart transfer.", 409);
  }

  const partSize = multipartPartSize(Number(upload.expectedByteSize));
  if (
    partNumber >
    maximumPartNumber(Number(upload.expectedByteSize), partSize)
  ) {
    throw new FileServiceError("Part number is outside this file.", 422);
  }

  const signed = await storageOperation(() =>
    provider.signMultipartPart({
      key: upload.storageKey,
      providerUploadId: upload.providerUploadId!,
      partNumber,
    }),
  );

  return { url: signed.url, expiresAt: signed.expiresAt, partNumber };
}

export async function recoverProjectUpload(
  authUser: AuthUser,
  projectId: string,
  uploadSessionId: string,
  storage?: FileStorageProvider,
) {
  const upload = await getUpload(authUser, projectId, uploadSessionId);
  const provider = configuredStorage(storage);
  requireTransferStatus(upload.status);

  if (upload.uploadType === "SINGLE_PART") {
    const signed = await storageOperation(() =>
      provider.signSinglePartUpload({
        key: upload.storageKey,
        contentType: upload.expectedContentType,
      }),
    );
    return {
      uploadType: upload.uploadType,
      expectedFilename: upload.expectedFilename,
      expectedByteSize: upload.expectedByteSize.toString(),
      expectedContentType: upload.expectedContentType,
      partSize: null,
      uploadedParts: [],
      uploadUrl: signed.url,
      signedUrlExpiresAt: signed.expiresAt,
      sessionExpiresAt: upload.expiresAt,
    };
  }

  if (!upload.providerUploadId) {
    throw new FileServiceError("Multipart transfer is not initialized.", 409);
  }

  const parts = await storageOperation(() =>
    provider.listMultipartParts({
      key: upload.storageKey,
      providerUploadId: upload.providerUploadId!,
    }),
  );
  return {
    uploadType: upload.uploadType,
    expectedFilename: upload.expectedFilename,
    expectedByteSize: upload.expectedByteSize.toString(),
    expectedContentType: upload.expectedContentType,
    partSize: multipartPartSize(Number(upload.expectedByteSize)),
    uploadedParts: parts.map((part) => ({
      partNumber: part.partNumber,
      size: part.size,
    })),
    uploadUrl: null,
    signedUrlExpiresAt: null,
    sessionExpiresAt: upload.expiresAt,
  };
}

function validateProviderParts(
  parts: Awaited<ReturnType<FileStorageProvider["listMultipartParts"]>>,
  expectedByteSize: number,
) {
  if (!parts.length) {
    throw new FileServiceError("No uploaded parts were found.", 409);
  }

  const total = parts.reduce((sum, part, index) => {
    if (part.partNumber !== index + 1) {
      throw new FileServiceError(
        "The uploaded parts are incomplete. Resume the transfer.",
        409,
      );
    }
    return sum + part.size;
  }, 0);

  if (total !== expectedByteSize) {
    throw new FileServiceError(
      "The uploaded byte count does not match the selected file.",
      409,
    );
  }
}

async function markReady(authUser: AuthUser, uploadSessionId: string) {
  return prisma.$transaction(async (transaction) => {
    const upload = await transaction.uploadSession.findUniqueOrThrow({
      where: { id: uploadSessionId },
      include: { fileAsset: true },
    });
    const changed = await transaction.fileAsset.updateMany({
      where: { id: upload.fileAssetId, status: "PENDING" },
      data: { status: "READY", verifiedAt: new Date() },
    });
    await transaction.uploadSession.update({
      where: { id: upload.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    if (changed.count === 1) {
      await transaction.activity.create({
        data: {
          workspaceId: authUser.workspaceId,
          projectId: upload.projectId,
          actorMembershipId: authUser.membershipId,
          action: "FILE_READY",
          entityType: "FileAsset",
          entityId: upload.fileAssetId,
          metadata: {
            purpose: upload.fileAsset.purpose,
            sizeBytes: upload.fileAsset.sizeBytes.toString(),
          },
          clientVisible: false,
        },
      });
    }

    return upload.fileAssetId;
  });
}

export async function completeProjectUpload(
  authUser: AuthUser,
  projectId: string,
  uploadSessionId: string,
  storage?: FileStorageProvider,
) {
  let upload = await getUpload(authUser, projectId, uploadSessionId);
  const provider = configuredStorage(storage);

  if (upload.status === "COMPLETED") {
    return listProjectFiles(authUser, projectId);
  }
  requireTransferStatus(upload.status);

  if (upload.status === "UPLOADING" || upload.status === "CREATED") {
    await prisma.uploadSession.update({
      where: { id: upload.id },
      data: {
        status:
          upload.uploadType === "MULTIPART" ? "COMPLETING" : "VERIFYING",
      },
    });
    upload = await getUpload(authUser, projectId, uploadSessionId);
  }

  try {
    let completedObject: Awaited<ReturnType<FileStorageProvider["headObject"]>> | null =
      null;

    if (upload.uploadType === "MULTIPART" && upload.status === "COMPLETING") {
      if (!upload.providerUploadId) {
        throw new FileServiceError(
          "Multipart transfer is not initialized.",
          409,
        );
      }

      try {
        completedObject = await provider.headObject(upload.storageKey);
      } catch {
        const parts = await provider.listMultipartParts({
          key: upload.storageKey,
          providerUploadId: upload.providerUploadId,
        });
        validateProviderParts(parts, Number(upload.expectedByteSize));
        await provider.completeMultipartUpload({
          key: upload.storageKey,
          providerUploadId: upload.providerUploadId,
          parts,
        });
      }
      await prisma.uploadSession.update({
        where: { id: upload.id },
        data: { status: "VERIFYING" },
      });
    }

    const object = completedObject ?? (await provider.headObject(upload.storageKey));
    const typeMismatch =
      object.contentType !== null &&
      object.contentType !== upload.expectedContentType.toLowerCase();

    if (
      object.byteSize !== Number(upload.expectedByteSize) ||
      typeMismatch
    ) {
      await markUploadFailed(upload.id, upload.fileAssetId);
      throw new FileServiceError(
        "The stored file did not match the authorized transfer.",
        409,
      );
    }

    await markReady(authUser, upload.id);
    return listProjectFiles(authUser, projectId);
  } catch (error) {
    if (error instanceof FileServiceError) throw error;
    throw new FileServiceError(
      "Storage verification is still pending. Retry in a moment.",
      503,
    );
  }
}

export async function abortProjectUpload(
  authUser: AuthUser,
  projectId: string,
  uploadSessionId: string,
  storage?: FileStorageProvider,
) {
  const upload = await getUpload(authUser, projectId, uploadSessionId);
  const provider = configuredStorage(storage);

  if (upload.status === "ABORTED") return { aborted: true };
  requireTransferStatus(upload.status);

  try {
    if (upload.uploadType === "MULTIPART" && upload.providerUploadId) {
      await provider.abortMultipartUpload({
        key: upload.storageKey,
        providerUploadId: upload.providerUploadId,
      });
    }
  } catch {
    throw new FileServiceError(
      "The transfer could not be cancelled yet. Retry in a moment.",
      503,
    );
  }

  await prisma.$transaction([
    prisma.uploadSession.update({
      where: { id: upload.id },
      data: { status: "ABORTED", abortedAt: new Date() },
    }),
    prisma.fileAsset.updateMany({
      where: { id: upload.fileAssetId, status: "PENDING" },
      data: { status: "FAILED" },
    }),
  ]);

  return { aborted: true };
}

export async function authorizeFileDownload(
  authUser: AuthUser,
  projectId: string,
  fileAssetId: string,
  storage?: FileStorageProvider,
) {
  await requireProject(authUser, projectId);
  const asset = await prisma.fileAsset.findFirst({
    where: {
      id: fileAssetId,
      workspaceId: authUser.workspaceId,
      projectId,
      deletedAt: null,
      archivedAt: null,
    },
  });

  if (!asset || !canDownloadAsset(authUser.role, asset)) {
    throw new FileServiceError("File not found.", 404);
  }

  const provider = configuredStorage(storage);
  const signed = await storageOperation(() =>
    provider.signDownload({
      key: asset.storageKey,
      filename: asset.originalFilename,
    }),
  );
  return { url: signed.url, expiresAt: signed.expiresAt };
}

export async function softDeleteProjectFile(
  authUser: AuthUser,
  projectId: string,
  fileAssetId: string,
) {
  if (!isWorkspaceManager(authUser)) {
    throw new FileServiceError("Only workspace managers can remove files.", 403);
  }
  await requireProject(authUser, projectId);

  const now = new Date();
  const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000);
  const changed = await prisma.fileAsset.updateMany({
    where: {
      id: fileAssetId,
      workspaceId: authUser.workspaceId,
      projectId,
      status: "READY",
      deletedAt: null,
    },
    data: { status: "DELETED", deletedAt: now, purgeAfter },
  });

  if (changed.count !== 1) {
    throw new FileServiceError("Ready file not found.", 404);
  }

  await prisma.activity.create({
    data: {
      workspaceId: authUser.workspaceId,
      projectId,
      actorMembershipId: authUser.membershipId,
      action: "FILE_DELETED",
      entityType: "FileAsset",
      entityId: fileAssetId,
      metadata: { purgeAfter: purgeAfter.toISOString() },
      clientVisible: false,
    },
  });

  return { deleted: true, purgeAfter };
}
