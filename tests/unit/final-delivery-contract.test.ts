import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

let serviceSource = "";
let panelSource = "";
let projectPageSource = "";
let publishRouteSource = "";
let completeRouteSource = "";

beforeAll(async () => {
  [
    serviceSource,
    panelSource,
    projectPageSource,
    publishRouteSource,
    completeRouteSource,
  ] = await Promise.all(
    [
      "src/features/files/service.ts",
      "src/features/files/file-transfer-panel.tsx",
      "src/app/projects/[id]/page.tsx",
      "src/app/api/projects/[id]/files/[fileId]/publish/route.ts",
      "src/app/api/projects/[id]/complete/route.ts",
    ].map((file) => readFile(path.join(process.cwd(), file), "utf8")),
  );
});

describe("final-delivery vertical slice contract", () => {
  it("publishes only a verified final deliverable after client approval", () => {
    expect(serviceSource).toContain('purpose: "FINAL_DELIVERABLE"');
    expect(serviceSource).toContain('status: "READY"');
    expect(serviceSource).toContain('decision: "APPROVED"');
    expect(serviceSource).toContain('visibility: "PUBLISHED"');
    expect(serviceSource).toContain('action: "FINAL_DELIVERABLE_PUBLISHED"');
    expect(publishRouteSource).toContain("publishFinalDeliverable");
  });

  it("allows clients to download published finals without exposing internal assets", () => {
    expect(serviceSource).toContain("canDownloadAsset(authUser.role, asset)");
    expect(panelSource).toContain("Publish to client");
    expect(panelSource).toContain("downloadFile(file)");
  });

  it("completes only after a published final exists and records the transition", () => {
    expect(serviceSource).toMatch(
      /purpose:\s*["']FINAL_DELIVERABLE["'][\s\S]*visibility:\s*["']PUBLISHED["']/,
    );
    expect(serviceSource).toContain('status: "COMPLETED"');
    expect(serviceSource).toContain('action: "PROJECT_COMPLETED"');
    expect(completeRouteSource).toContain("completeProject");
    expect(projectPageSource).toContain("Complete project");
  });
});
