import { describe, expect, it } from "vitest";

import {
  allowedUploadPurposes,
  buildStorageKey,
  canDownloadAsset,
} from "@/features/files/policy";
import {
  initiateUploadRequestSchema,
  kindFromContentType,
  maximumPartNumber,
  MAX_FILE_SIZE_BYTES,
  multipartPartSize,
  SINGLE_PART_MAX_BYTES,
  uploadTypeForSize,
} from "@/features/files/schema";
import {
  canReserveStorage,
  createStorageQuotaSnapshot,
} from "@/features/files/quota";

describe("file transfer validation and policy", () => {
  it("normalizes an authorized upload declaration", () => {
    expect(
      initiateUploadRequestSchema.parse({
        filename: "  launch-master.mov  ",
        byteSize: 4_500_000_000,
        contentType: "VIDEO/QUICKTIME",
        purpose: "SOURCE",
      }),
    ).toEqual({
      filename: "launch-master.mov",
      byteSize: 4_500_000_000,
      contentType: "video/quicktime",
      purpose: "SOURCE",
    });
  });

  it("rejects path-like names, unsupported content, and oversize declarations", () => {
    expect(
      initiateUploadRequestSchema.safeParse({
        filename: "../secret.env",
        byteSize: 100,
        contentType: "application/x-msdownload",
        purpose: "SOURCE",
      }).success,
    ).toBe(false);
    expect(
      initiateUploadRequestSchema.safeParse({
        filename: "raw.mov",
        byteSize: MAX_FILE_SIZE_BYTES + 1,
        contentType: "video/quicktime",
        purpose: "SOURCE",
      }).success,
    ).toBe(false);
  });

  it("selects multipart transfer and a bounded part count for large files", () => {
    expect(uploadTypeForSize(SINGLE_PART_MAX_BYTES)).toBe("SINGLE_PART");
    expect(uploadTypeForSize(SINGLE_PART_MAX_BYTES + 1)).toBe("MULTIPART");
    const partSize = multipartPartSize(MAX_FILE_SIZE_BYTES);
    expect(maximumPartNumber(MAX_FILE_SIZE_BYTES, partSize)).toBeLessThanOrEqual(
      10_000,
    );
  });

  it("maps upload types and creates an opaque, tenant-scoped object key", () => {
    expect(kindFromContentType("audio/wav")).toBe("AUDIO");
    expect(kindFromContentType("application/zip")).toBe("ARCHIVE");
    expect(
      buildStorageKey({
        workspaceId: "workspace_1",
        projectId: "project_1",
        purpose: "REFERENCE",
        fileAssetId: "asset_1",
      }),
    ).toBe("workspaces/workspace_1/projects/project_1/reference/asset_1");
  });

  it("limits client purposes and downloads to published final deliverables", () => {
    expect(allowedUploadPurposes("CLIENT")).toEqual(["SOURCE", "REFERENCE"]);
    expect(allowedUploadPurposes("MEMBER")).toContain("ATTACHMENT");
    expect(allowedUploadPurposes("OWNER")).toContain("FINAL_DELIVERABLE");
    expect(
      canDownloadAsset("CLIENT", {
        status: "READY",
        visibility: "INTERNAL",
        purpose: "SOURCE",
      }),
    ).toBe(false);
    expect(
      canDownloadAsset("CLIENT", {
        status: "READY",
        visibility: "PUBLISHED",
        purpose: "FINAL_DELIVERABLE",
      }),
    ).toBe(true);
  });

  it("reports reserved storage and rejects capacity over the remaining guard", () => {
    const storage = createStorageQuotaSnapshot(105_906_567n, 8_000_000_000);

    expect(storage).toEqual({
      quotaBytes: "8000000000",
      usedBytes: "105906567",
      remainingBytes: "7894093433",
      usagePercent: 1.3,
    });
    expect(canReserveStorage(storage, 7_894_093_433)).toBe(true);
    expect(canReserveStorage(storage, 7_894_093_434)).toBe(false);
  });
});
