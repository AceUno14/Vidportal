import { readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const appDirectory = path.join(process.cwd(), "src", "app");
const routeFilePattern = /^(?:page|route)\.(?:js|jsx|ts|tsx)$/;

const expectedRoutes = [
  "/",
  "/api/auth/[...all]",
  "/api/auth/context",
  "/api/auth/signup",
  "/api/auth/workspace",
  "/api/clients",
  "/api/clients/[id]/create-login",
  "/api/health",
  "/api/projects",
  "/api/projects/[id]",
  "/api/projects/[id]/files",
  "/api/projects/[id]/files/[fileId]",
  "/clients",
  "/login",
  "/projects/[id]",
].sort();

function routePath(relativeDirectory: string) {
  const segments = relativeDirectory
    .split(path.sep)
    .filter(Boolean)
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .filter((segment) => !segment.startsWith("@"));

  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

async function discoverRoutes(
  directory: string,
  relativeDirectory = "",
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const routes: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      routes.push(
        ...(await discoverRoutes(
          path.join(directory, entry.name),
          path.join(relativeDirectory, entry.name),
        )),
      );
      continue;
    }

    if (entry.isFile() && routeFilePattern.test(entry.name)) {
      routes.push(routePath(relativeDirectory));
    }
  }

  return routes;
}

describe("Next.js route inventory", () => {
  it("matches the Phase 2 authentication route surface", async () => {
    const routes = (await discoverRoutes(appDirectory)).sort();

    expect(routes).toEqual(expectedRoutes);
    expect(new Set(routes).size).toBe(15);
  });
});
