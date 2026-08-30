import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserFromRequest } from "@/lib/auth";
import { toLegacyClient } from "@/lib/prototype-compat";

export async function GET(request: Request) {
  const authUser = getAuthUserFromRequest(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (authUser.role === "CLIENT") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const clients = await prisma.client.findMany({
    where: { workspaceId: authUser.workspaceId },
    include: { _count: { select: { projects: true, memberships: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: clients.map((client) => ({
      ...toLegacyClient(client),
      _count: {
        projects: client._count.projects,
        users: client._count.memberships,
      },
    })),
  });
}

export async function POST(request: Request) {
  const authUser = getAuthUserFromRequest(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (authUser.role === "CLIENT") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.name || !body.email) {
    return NextResponse.json({ error: "name and email are required" }, { status: 400 });
  }

  const existing = await prisma.client.findFirst({
    where: { workspaceId: authUser.workspaceId, email: body.email },
  });

  if (existing) {
    return NextResponse.json({ error: "a client with this email already exists" }, { status: 409 });
  }

  const client = await prisma.client.create({
    data: {
      workspaceId: authUser.workspaceId,
      name: body.name,
      email: body.email,
      company: body.company || null,
    },
  });

  return NextResponse.json({ data: toLegacyClient(client) }, { status: 201 });
}
