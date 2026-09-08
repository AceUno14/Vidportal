/**
 * Focused regression coverage for the CLIENT FileAsset metadata exposure fix in
 * GET /api/projects. The route is executed for real with only the better-auth
 * session and the Prisma client mocked, so the actual authorization policy and
 * serialization pipeline are exercised.
 *
 * @vitest-environment node
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../../src/app/api/projects/route";
import { clientVisibleFileAssetWhere } from "@/features/files/policy";
import type { AuthUser } from "@/server/authorization";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  membershipFindFirst: vi.fn(),
  sessionUpdateMany: vi.fn(),
  projectFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: { findFirst: mocks.membershipFindFirst },
    session: { updateMany: mocks.sessionUpdateMany },
    project: { findMany: mocks.projectFindMany },
  },
}));

const WORKSPACE_ID = "workspace_demo";
const CLIENT_MEMBERSHIP_ID = "membership_client";
const CLIENT_ID = "client_demo";

type SerializedProject = {
  id: string;
  files: Array<Record<string, unknown>>;
};

type ProjectFindManyArgs = {
  where: Record<string, unknown>;
  include: {
    client: boolean;
    fileAssets: {
      where?: Record<string, unknown>;
      select: Record<string, unknown>;
    };
  };
};

function authUserFixture(
  role: AuthUser["role"],
  overrides: Partial<AuthUser> = {},
): AuthUser {
  return {
    id: `user_${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@example.com`,
    name: "Test User",
    image: null,
    sessionId: "session_demo",
    workspaceId: WORKSPACE_ID,
    workspaceName: "Demo Workspace",
    workspaceSlug: "demo-workspace",
    membershipId:
      role === "CLIENT"
        ? CLIENT_MEMBERSHIP_ID
        : `membership_${role.toLowerCase()}`,
    role,
    clientId: role === "CLIENT" ? CLIENT_ID : null,
    ...overrides,
  };
}

function authenticate(user: AuthUser) {
  mocks.getSession.mockResolvedValue({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    },
    session: { id: user.sessionId, activeWorkspaceId: user.workspaceId },
  });
  mocks.membershipFindFirst.mockResolvedValue({
    id: user.membershipId,
    workspaceId: user.workspaceId,
    role: user.role,
    clientId: user.clientId,
    workspace: { name: user.workspaceName, slug: user.workspaceSlug },
  });
}

function fileAssetFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "file_demo",
    projectId: "project_demo",
    originalFilename: "demo-cut.mp4",
    storageKey: "workspaces/demo/projects/demo/final/SECRET_STORAGE_KEY",
    contentType: "video/mp4",
    kind: "VIDEO",
    sizeBytes: 1_048_576n,
    durationSeconds: 90.5,
    createdAt: new Date("2026-01-03T00:00:00.000Z"),
    ...overrides,
  };
}

function projectFixture(fileAssets: Record<string, unknown>[]) {
  return {
    id: "project_demo",
    workspaceId: WORKSPACE_ID,
    clientId: CLIENT_ID,
    name: "Launch film",
    type: null,
    status: "FINAL_DELIVERY",
    deliveryDate: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    client: {
      id: CLIENT_ID,
      workspaceId: WORKSPACE_ID,
      name: "Acme Co",
      email: "acme@example.com",
      company: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    fileAssets,
  };
}

async function getProjectsResponse() {
  const response = await GET(
    new Request("http://localhost:3000/api/projects"),
  );

  return {
    response,
    body: (await response.json()) as { data: SerializedProject[] },
  };
}

function lastFindManyArgs(): ProjectFindManyArgs {
  const calls = mocks.projectFindMany.mock.calls;
  expect(calls).toHaveLength(1);
  return calls[0][0] as ProjectFindManyArgs;
}

function clientVisibilityWhere() {
  const where = lastFindManyArgs().include.fileAssets.where;
  expect(where).toBeDefined();
  return where as { OR: Array<Record<string, unknown>> };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/projects client FileAsset exposure", () => {
  it("rejects unauthenticated requests", async () => {
    authenticate(authUserFixture("CLIENT"));
    mocks.getSession.mockResolvedValue(null);
    mocks.projectFindMany.mockResolvedValue([]);

    const { response } = await getProjectsResponse();

    expect(response.status).toBe(401);
    expect(mocks.projectFindMany).not.toHaveBeenCalled();
  });

  it("keeps CLIENT project access workspace-scoped and associated-client-scoped", async () => {
    authenticate(authUserFixture("CLIENT"));
    mocks.projectFindMany.mockResolvedValue([projectFixture([])]);

    await getProjectsResponse();

    expect(lastFindManyArgs().where).toEqual({
      workspaceId: WORKSPACE_ID,
      clientId: CLIENT_ID,
    });
  });

  it("applies the dedicated file-list CLIENT visibility rule at the Prisma level", async () => {
    const user = authUserFixture("CLIENT");
    authenticate(user);
    mocks.projectFindMany.mockResolvedValue([projectFixture([])]);

    await getProjectsResponse();

    expect(lastFindManyArgs().include.fileAssets.where).toEqual(
      clientVisibleFileAssetWhere(user.membershipId),
    );
    expect(clientVisibilityWhere().OR).toEqual([
      {
        status: "READY",
        visibility: "PUBLISHED",
        purpose: "FINAL_DELIVERABLE",
      },
      {
        uploadedByMembershipId: CLIENT_MEMBERSHIP_ID,
        purpose: { in: ["SOURCE", "REFERENCE"] },
        status: { notIn: ["DELETED", "ARCHIVED"] },
      },
    ]);
  });

  it("returns READY published final-deliverable metadata to CLIENT", async () => {
    authenticate(authUserFixture("CLIENT"));
    mocks.projectFindMany.mockResolvedValue([
      projectFixture([
        fileAssetFixture({
          id: "file_published_final",
          purpose: "FINAL_DELIVERABLE",
          visibility: "PUBLISHED",
          status: "READY",
        }),
      ]),
    ]);

    const { body } = await getProjectsResponse();

    expect(body.data[0].files).toEqual([
      {
        id: "file_published_final",
        projectId: "project_demo",
        name: "demo-cut.mp4",
        mimeType: "video/mp4",
        kind: "VIDEO",
        sizeBytes: "1048576",
        durationSeconds: 90.5,
        version: 1,
        createdAt: "2026-01-03T00:00:00.000Z",
      },
    ]);
  });

  it("returns its own eligible SOURCE/REFERENCE upload metadata to CLIENT", async () => {
    authenticate(authUserFixture("CLIENT"));
    mocks.projectFindMany.mockResolvedValue([
      projectFixture([
        fileAssetFixture({
          id: "file_own_source",
          purpose: "SOURCE",
          visibility: "INTERNAL",
          status: "READY",
        }),
        fileAssetFixture({
          id: "file_own_reference",
          purpose: "REFERENCE",
          visibility: "CLIENT",
          status: "PENDING",
        }),
      ]),
    ]);

    const { body } = await getProjectsResponse();

    expect(body.data[0].files.map((file) => file.id)).toEqual([
      "file_own_source",
      "file_own_reference",
    ]);
  });

  it("never selects storageKey for nested project-list files", async () => {
    authenticate(authUserFixture("CLIENT"));
    mocks.projectFindMany.mockResolvedValue([projectFixture([])]);

    await getProjectsResponse();

    expect(lastFindManyArgs().include.fileAssets.select).toEqual({
      id: true,
      projectId: true,
      originalFilename: true,
      contentType: true,
      kind: true,
      sizeBytes: true,
      durationSeconds: true,
      createdAt: true,
    });
  });

  it("strips storageKey from serialized project-list files", async () => {
    authenticate(authUserFixture("CLIENT"));
    mocks.projectFindMany.mockResolvedValue([
      projectFixture([
        fileAssetFixture({
          id: "file_published_final",
          purpose: "FINAL_DELIVERABLE",
          visibility: "PUBLISHED",
          status: "READY",
        }),
      ]),
    ]);

    const { body } = await getProjectsResponse();

    for (const file of body.data[0].files) {
      expect(file).not.toHaveProperty("storageKey");
    }
    expect(JSON.stringify(body)).not.toContain("SECRET_STORAGE_KEY");
  });

  it("does not expose internal attachments to CLIENT", async () => {
    authenticate(authUserFixture("CLIENT"));
    mocks.projectFindMany.mockResolvedValue([projectFixture([])]);

    await getProjectsResponse();

    const where = clientVisibilityWhere();
    expect(where.OR[1].purpose).toEqual({ in: ["SOURCE", "REFERENCE"] });
    expect(where.OR[0].purpose).toEqual("FINAL_DELIVERABLE");
  });

  it("does not expose staff-uploaded SOURCE/REFERENCE files to CLIENT", async () => {
    authenticate(authUserFixture("CLIENT"));
    mocks.projectFindMany.mockResolvedValue([projectFixture([])]);

    await getProjectsResponse();

    const ownUploadBranch = clientVisibilityWhere().OR[1];
    expect(ownUploadBranch.uploadedByMembershipId).toBe(CLIENT_MEMBERSHIP_ID);
    expect(ownUploadBranch.purpose).toEqual({ in: ["SOURCE", "REFERENCE"] });
  });

  it("does not expose unrelated-client uploads to CLIENT", async () => {
    authenticate(authUserFixture("CLIENT"));
    mocks.projectFindMany.mockResolvedValue([projectFixture([])]);

    await getProjectsResponse();

    expect(clientVisibilityWhere().OR[1].uploadedByMembershipId).toBe(
      CLIENT_MEMBERSHIP_ID,
    );
  });

  it("does not expose unpublished final-deliverable metadata to CLIENT", async () => {
    authenticate(authUserFixture("CLIENT"));
    mocks.projectFindMany.mockResolvedValue([projectFixture([])]);

    await getProjectsResponse();

    expect(clientVisibilityWhere().OR[0]).toEqual({
      status: "READY",
      visibility: "PUBLISHED",
      purpose: "FINAL_DELIVERABLE",
    });
  });

  it("does not expose deleted or archived files to CLIENT", async () => {
    authenticate(authUserFixture("CLIENT"));
    mocks.projectFindMany.mockResolvedValue([projectFixture([])]);

    await getProjectsResponse();

    const where = clientVisibilityWhere();
    expect(where.OR[1].status).toEqual({ notIn: ["DELETED", "ARCHIVED"] });
    expect(where.OR[0].status).toEqual("READY");
  });

  it.each(["OWNER", "ADMIN"] as const)(
    "keeps %s file visibility unchanged with all attached assets",
    async (role) => {
      authenticate(authUserFixture(role));
      mocks.projectFindMany.mockResolvedValue([
        projectFixture([
          fileAssetFixture({ id: "file_ready", status: "READY" }),
          fileAssetFixture({
            id: "file_deleted",
            status: "DELETED",
            deletedAt: new Date("2026-01-04T00:00:00.000Z"),
          }),
          fileAssetFixture({
            id: "file_archived",
            status: "ARCHIVED",
            archivedAt: new Date("2026-01-04T00:00:00.000Z"),
          }),
        ]),
      ]);

      const { body } = await getProjectsResponse();

      expect(lastFindManyArgs().where).toEqual({ workspaceId: WORKSPACE_ID });
      expect(lastFindManyArgs().include.fileAssets.where).toBeUndefined();
      expect(body.data[0].files.map((file) => file.id)).toEqual([
        "file_ready",
        "file_deleted",
        "file_archived",
      ]);
      for (const file of body.data[0].files) {
        expect(file).not.toHaveProperty("storageKey");
      }
    },
  );

  it("keeps MEMBER file visibility unchanged with all attached assets", async () => {
    const user = authUserFixture("MEMBER");
    authenticate(user);
    mocks.projectFindMany.mockResolvedValue([
      projectFixture([
        fileAssetFixture({ id: "file_member_source", status: "READY" }),
      ]),
    ]);

    const { body } = await getProjectsResponse();

    expect(lastFindManyArgs().where).toEqual({
      workspaceId: WORKSPACE_ID,
      assignments: {
        some: {
          membershipId: user.membershipId,
          active: true,
          removedAt: null,
        },
      },
    });
    expect(lastFindManyArgs().include.fileAssets.where).toBeUndefined();
    expect(body.data[0].files.map((file) => file.id)).toEqual([
      "file_member_source",
    ]);
    expect(body.data[0].files[0]).not.toHaveProperty("storageKey");
  });
});

describe("shared CLIENT file visibility predicate", () => {
  it("is extracted once in the file policy layer and reused by the file-list service", async () => {
    const [policySource, serviceSource] = await Promise.all(
      ["src/features/files/policy.ts", "src/features/files/service.ts"].map(
        (file) => readFile(path.join(process.cwd(), file), "utf8"),
      ),
    );

    expect(policySource).toContain(
      "export function clientVisibleFileAssetWhere",
    );
    expect(serviceSource).toContain(
      "clientVisibleFileAssetWhere(authUser.membershipId)",
    );
  });
});

