import type {
  FilePurpose,
  FileVisibility,
  MembershipRole,
} from "@/generated/prisma/client";
import type { UploadPurpose } from "@/features/files/schema";

export function allowedUploadPurposes(role: MembershipRole): UploadPurpose[] {
  return role === "CLIENT"
    ? ["SOURCE", "REFERENCE"]
    : ["SOURCE", "REFERENCE", "ATTACHMENT"];
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
