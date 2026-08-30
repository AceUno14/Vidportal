import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUserFromRequest } from "@/server/authorization";

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.membership.findMany({
    where: {
      userId: authUser.id,
      status: "ACTIVE",
      deactivatedAt: null,
      workspace: { archivedAt: null },
    },
    include: { workspace: true },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json({
    data: {
      user: {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
        image: authUser.image,
      },
      membership: {
        id: authUser.membershipId,
        role: authUser.role,
        clientId: authUser.clientId,
      },
      workspace: {
        id: authUser.workspaceId,
        name: authUser.workspaceName,
        slug: authUser.workspaceSlug,
      },
      memberships: memberships.map((membership) => ({
        id: membership.id,
        role: membership.role,
        clientId: membership.clientId,
        workspace: {
          id: membership.workspace.id,
          name: membership.workspace.name,
          slug: membership.workspace.slug,
        },
      })),
    },
  });
}
