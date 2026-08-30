import "server-only";

import type { MembershipRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/server/auth";

export {
  isWorkspaceManager,
  projectWhereForAuth,
} from "@/server/authorization-policy";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  sessionId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  membershipId: string;
  role: MembershipRole;
  clientId: string | null;
};

export async function getBetterAuthSession(request: Request) {
  return auth.api.getSession({ headers: request.headers });
}

export async function getAuthUserFromRequest(
  request: Request,
): Promise<AuthUser | null> {
  const session = await getBetterAuthSession(request);

  if (!session) {
    return null;
  }

  const activeWorkspaceId = session.session.activeWorkspaceId;
  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
      deactivatedAt: null,
      workspace: { archivedAt: null },
      ...(activeWorkspaceId ? { workspaceId: activeWorkspaceId } : {}),
    },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });

  if (!membership) {
    return null;
  }

  if (!activeWorkspaceId) {
    await prisma.session.updateMany({
      where: { id: session.session.id, userId: session.user.id },
      data: { activeWorkspaceId: membership.workspaceId },
    });
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image ?? null,
    sessionId: session.session.id,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
    workspaceSlug: membership.workspace.slug,
    membershipId: membership.id,
    role: membership.role,
    clientId: membership.clientId,
  };
}
