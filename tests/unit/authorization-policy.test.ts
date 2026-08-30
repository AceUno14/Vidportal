import { describe, expect, it } from "vitest";

import {
  isWorkspaceManager,
  projectWhereForAuth,
  type AuthorizationSubject,
} from "@/server/authorization-policy";

function subject(
  role: AuthorizationSubject["role"],
  clientId: string | null = null,
): AuthorizationSubject {
  return {
    workspaceId: "workspace_one",
    membershipId: "membership_one",
    role,
    clientId,
  };
}

describe("workspace authorization policy", () => {
  it.each(["OWNER", "ADMIN"] as const)("treats %s as a workspace manager", (role) => {
    expect(isWorkspaceManager(subject(role))).toBe(true);
    expect(projectWhereForAuth(subject(role), "project_one")).toEqual({
      workspaceId: "workspace_one",
      id: "project_one",
    });
  });

  it("limits members to active project assignments", () => {
    expect(isWorkspaceManager(subject("MEMBER"))).toBe(false);
    expect(projectWhereForAuth(subject("MEMBER"))).toEqual({
      workspaceId: "workspace_one",
      assignments: {
        some: {
          membershipId: "membership_one",
          active: true,
          removedAt: null,
        },
      },
    });
  });

  it("limits clients to projects owned by their associated client", () => {
    expect(projectWhereForAuth(subject("CLIENT", "client_one"))).toEqual({
      workspaceId: "workspace_one",
      clientId: "client_one",
    });
  });

  it("fails closed when a client membership has no associated client", () => {
    expect(projectWhereForAuth(subject("CLIENT"))).toEqual({
      workspaceId: "workspace_one",
      clientId: "__missing_client_membership__",
    });
  });
});
