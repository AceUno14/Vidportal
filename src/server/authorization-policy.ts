import type { MembershipRole, Prisma } from "@/generated/prisma/client";

export type AuthorizationSubject = {
  workspaceId: string;
  membershipId: string;
  role: MembershipRole;
  clientId: string | null;
};

export function isWorkspaceManager(user: AuthorizationSubject) {
  return user.role === "OWNER" || user.role === "ADMIN";
}

export function projectWhereForAuth(
  user: AuthorizationSubject,
  id?: string,
): Prisma.ProjectWhereInput {
  const base: Prisma.ProjectWhereInput = {
    workspaceId: user.workspaceId,
    ...(id ? { id } : {}),
  };

  if (user.role === "MEMBER") {
    return {
      ...base,
      assignments: {
        some: {
          membershipId: user.membershipId,
          active: true,
          removedAt: null,
        },
      },
    };
  }

  if (user.role === "CLIENT") {
    return {
      ...base,
      clientId: user.clientId ?? "__missing_client_membership__",
    };
  }

  return base;
}
