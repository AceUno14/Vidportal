import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

let serviceSource = "";
let providerSource = "";
let filesRouteSource = "";
let transferPanelSource = "";
let legacyFileRouteSource = "";

beforeAll(async () => {
  [
    serviceSource,
    providerSource,
    filesRouteSource,
    transferPanelSource,
    legacyFileRouteSource,
  ] = await Promise.all(
    [
      "src/features/files/service.ts",
      "src/features/files/r2-provider.ts",
      "src/app/api/projects/[id]/files/route.ts",
      "src/features/files/file-transfer-panel.tsx",
      "src/app/api/projects/[id]/files/[fileId]/route.ts",
    ].map((file) => readFile(path.join(process.cwd(), file), "utf8")),
  );
});

describe("R2 file-exchange vertical slice contract", () => {
  it("moves bytes directly to R2 rather than through the Next.js server", () => {
    expect(filesRouteSource).not.toContain("request.formData");
    expect(filesRouteSource).not.toMatch(/writeFile|public["']?,\s*["']uploads/);
    expect(transferPanelSource).toContain("XMLHttpRequest");
    expect(transferPanelSource).toMatch(/xhr\.open\(["']PUT["']/);
  });

  it("binds provider work to server-owned sessions and verifies readiness", () => {
    expect(serviceSource).toContain("buildStorageKey");
    expect(serviceSource).toContain("projectWhereForAuth");
    expect(serviceSource).toContain("providerUploadId");
    expect(serviceSource).toContain("headObject");
    expect(serviceSource).toMatch(/status:\s*["']READY["']/);
    expect(serviceSource).toMatch(/action:\s*["']FILE_READY["']/);
    expect(providerSource).toContain("HeadObjectCommand");
    expect(providerSource).toContain("getSignedUrl");
  });

  it("implements multipart retry, ETag CORS evidence, recovery, and abort", () => {
    expect(transferPanelSource).toContain("uploadPartWithRetry");
    expect(transferPanelSource).toContain('getResponseHeader("ETag")');
    expect(transferPanelSource).toContain("uploadedParts");
    expect(providerSource).toContain("ListPartsCommand");
    expect(providerSource).toContain("AbortMultipartUploadCommand");
  });

  it("reserves a configurable storage quota before provider work", () => {
    expect(serviceSource).toContain("STORAGE_ACCOUNTING_WHERE");
    expect(serviceSource).toContain("pg_advisory_xact_lock");
    expect(serviceSource).toContain("canReserveStorage");
    expect(serviceSource).toMatch(/status:\s*\{\s*in:\s*\["PENDING",\s*"READY",\s*"ARCHIVED",\s*"DELETED"\]/);
    expect(transferPanelSource).toContain("Storage capacity");
    expect(transferPanelSource).toContain("used or reserved");
    expect(transferPanelSource).not.toContain("up to 50 GB");
  });

  it("replaces permanent local deletion with 30-day soft deletion", () => {
    expect(legacyFileRouteSource).not.toMatch(/unlink|fileAsset\.delete/);
    expect(serviceSource).toMatch(/status:\s*["']DELETED["']/);
    expect(serviceSource).toContain("purgeAfter");
  });
});
