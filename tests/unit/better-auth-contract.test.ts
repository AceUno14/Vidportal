import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

async function source(relativePath: string) {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

describe("Better Auth foundation contract", () => {
  it("exposes the Better Auth Next.js handler and disables unscoped public signup", async () => {
    const [handler, serverAuth] = await Promise.all([
      source("src/app/api/auth/[...all]/route.ts"),
      source("src/server/auth.ts"),
    ]);

    expect(handler).toMatch(/toNextJsHandler\s*\(\s*auth\s*\)/);
    expect(serverAuth).toMatch(/prismaAdapter\s*\(/);
    expect(serverAuth).toMatch(/disableSignUp\s*:\s*true/);
    expect(serverAuth).toMatch(/activeWorkspaceId/);
  });

  it("uses server cookie context instead of browser-stored bearer tokens", async () => {
    const clientSources = await Promise.all([
      source("src/app/page.tsx"),
      source("src/app/clients/page.tsx"),
      source("src/app/projects/[id]/page.tsx"),
      source("src/app/login/page.tsx"),
      source("src/app/register/page.tsx"),
    ]);
    const combined = clientSources.join("\n");

    expect(combined).not.toMatch(/localStorage/);
    expect(combined).not.toMatch(/Authorization\s*:/);
    expect(combined).not.toMatch(/Bearer\s/);
    expect(combined).not.toMatch(/\/api\/auth\/login/);
    expect(combined).toMatch(/authClient\.signIn\.email/);
    expect(combined).toMatch(/useCurrentAuth/);
  });

  it("offers workspace-aware registration without using Better Auth public signup", async () => {
    const [loginPage, registerPage, signupRoute] = await Promise.all([
      source("src/app/login/page.tsx"),
      source("src/app/register/page.tsx"),
      source("src/app/api/auth/signup/route.ts"),
    ]);

    expect(loginPage).toContain('href="/register"');
    expect(registerPage).toContain('fetch("/api/auth/signup"');
    expect(registerPage).toMatch(/name, agencyName, email, password/);
    expect(registerPage).toContain('router.replace("/")');
    expect(signupRoute).toMatch(/transaction\.workspace\.create/);
    expect(signupRoute).toMatch(/role:\s*"OWNER"/);
  });

  it("keeps workspace selection on the server session", async () => {
    const [schema, workspaceRoute, contextRoute] = await Promise.all([
      source("prisma/schema.prisma"),
      source("src/app/api/auth/workspace/route.ts"),
      source("src/app/api/auth/context/route.ts"),
    ]);

    expect(schema).toMatch(/model\s+Session[\s\S]*activeWorkspaceId\s+String\?/);
    expect(workspaceRoute).toMatch(/prisma\.session\.updateMany/);
    expect(workspaceRoute).toMatch(/status\s*:\s*["']ACTIVE["']/);
    expect(contextRoute).toMatch(/getAuthUserFromRequest/);
  });

  it("removes the legacy JWT dependency and environment contract", async () => {
    const [packageManifest, environmentExample] = await Promise.all([
      source("package.json"),
      source(".env.example"),
    ]);

    expect(packageManifest).not.toMatch(/jsonwebtoken|bcryptjs/i);
    expect(environmentExample).not.toMatch(/JWT_SECRET/);
  });
});
