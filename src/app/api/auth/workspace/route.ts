import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getBetterAuthSession } from "@/server/authorization";

export async function POST(request: Request) {
  const session = await getBetterAuthSession(request);

  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { workspaceId?: unknown };

  if (typeof body.workspaceId !== "string" || !body.workspaceId) {
    return NextResponse.json(
      { error: "workspaceId is required" },
      { status: 400 },
    );
  }

  const membership = await prisma.membership.findFirst({
    where: {
      workspaceId: body.workspaceId,
      userId: session.user.id,
      status: "ACTIVE",
      deactivatedAt: null,
      workspace: { archivedAt: null },
    },
    select: { workspaceId: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "workspace not found" }, { status: 404 });
  }

  await prisma.session.updateMany({
    where: { id: session.session.id, userId: session.user.id },
    data: { activeWorkspaceId: membership.workspaceId },
  });

  return new NextResponse(null, { status: 204 });
}
