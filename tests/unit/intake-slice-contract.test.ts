import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

let serviceSource = "";
let routeSource = "";
let projectRouteSource = "";
let panelSource = "";

beforeAll(async () => {
  [serviceSource, routeSource, projectRouteSource, panelSource] =
    await Promise.all(
      [
        "src/features/intake/service.ts",
        "src/app/api/projects/[id]/intake/route.ts",
        "src/app/api/projects/[id]/route.ts",
        "src/features/intake/intake-panel.tsx",
      ].map((file) => readFile(path.join(process.cwd(), file), "utf8")),
    );
});

describe("structured intake vertical slice contract", () => {
  it("requires the associated client for submission", () => {
    expect(serviceSource).toMatch(/authUser\.role\s*!==\s*["']CLIENT["']/);
    expect(serviceSource).toMatch(/projectWhereForAuth\s*\(\s*authUser/);
    expect(routeSource).toMatch(/getAuthUserFromRequest/);
  });

  it("submits the immutable snapshot, lifecycle transition, and activity atomically", () => {
    expect(serviceSource).toMatch(/prisma\.\$transaction/);
    expect(serviceSource).toMatch(/intakeSubmission\.create/);
    expect(serviceSource).toMatch(/definitionSnapshot/);
    expect(serviceSource).toMatch(/status\s*:\s*["']READY["']/);
    expect(serviceSource).toMatch(/activity\.create/);
    expect(serviceSource).toMatch(/action\s*:\s*["']INTAKE_SUBMITTED["']/);
  });

  it("prevents the prototype status control from bypassing intake", () => {
    expect(projectRouteSource).toMatch(
      /existing\.status\s*!==\s*["']READY["'][\s\S]*body\.status\s*!==\s*["']IN_PROGRESS["']/,
    );
    expect(panelSource).toContain("Send production brief");
    expect(panelSource).toContain("Answers lock when the brief is sent.");
  });
});
