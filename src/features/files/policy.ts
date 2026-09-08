import type {
  FilePurpose,
  FileVisibility,
  MembershipRole,
  Prisma,
} from "@/generated/prisma/client";
import type { UploadPurpose } from "@/features/files/schema";

export function allowedUploadPurposes(role: MembershipRole): UploadPurpose[] {
  return role === "CLIENT"
    ? ["SOURCE", "REFERENCE"]
    : ["SOURCE", "REFERENCE", "ATTACHMENT", "FINAL_DELIVERABLE"];
}

export function canDownloadAsset(
  role: MembershipRole,
  asset: { status: string; visibility: FileVisibility; purpose: FilePurpose },
) {
  if (asset.status !== "READY") return false;
  if (role !== "CLIENT") return true;
  return (
    asset.visibility === "PUBLISHED" &&
    asset.purpose === "FINAL_DELIVERABLE"
  );
}

export function buildStorageKey(input: {
  workspaceId: string;
  projectId: string;
  purpose: UploadPurpose;
  fileAssetId: string;
}) {
  return [
    "workspaces",
    input.workspaceId,
    "projects",
    input.projectId,
    input.purpose.toLowerCase(),
    input.fileAssetId,
  ].join("/");
}

/**
 * CLIENT FileAsset visibility shared by the dedicated file-list service and the
 * project-list API: a client sees ready published final deliverables plus its
 * own non-deleted, non-archived SOURCE and REFERENCE uploads.
 */
export function clientVisibleFileAssetWhere(
  uploadedByMembershipId: string,
): Prisma.FileAssetWhereInput {
  return {
    OR: [
      {
        status: "READY",
        visibility: "PUBLISHED",
        purpose: "FINAL_DELIVERABLE",
      },
      {
        uploadedByMembershipId,
        purpose: { in: ["SOURCE", "REFERENCE"] },
        status: { notIn: ["DELETED", "ARCHIVED"] },
      },
    ],
  };
}
