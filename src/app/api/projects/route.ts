import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  toLegacyClient,
  toLegacyFileAsset,
  toLegacyProject,
} from "@/lib/prototype-compat";
import {
  getAuthUserFromRequest,
  isWorkspaceManager,
  projectWhereForAuth,
} from "@/server/authorization";

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: projectWhereForAuth(authUser),
    include: { client: true, fileAssets: true },
    orderBy: { createdAt: "desc" },
  });

  const serialized = projects.map((project) => ({
    ...toLegacyProject(project),
    client: toLegacyClient(project.client),
    files: project.fileAssets.map(toLegacyFileAsset),
  }));

  return NextResponse.json({ data: serialized });
}

export async function POST(request: Request) {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isWorkspaceManager(authUser)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json();

  if (!body.name || !body.clientName || !body.clientEmail) {
    return NextResponse.json(
      { error: "name, clientName, and clientEmail are required" },
      { status: 400 }
    );
  }

  let client = await prisma.client.findFirst({
    where: { workspaceId: authUser.workspaceId, email: body.clientEmail },
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        workspaceId: authUser.workspaceId,
        name: body.clientName,
        email: body.clientEmail,
      },
    });
  }

  const project = await prisma.project.create({
    data: {
      workspaceId: authUser.workspaceId,
      clientId: client.id,
      name: body.name,
      status: "INTAKE",
    },
    include: { client: true },
  });

  return NextResponse.json(
    {
      data: {
        ...toLegacyProject(project),
        client: toLegacyClient(project.client),
      },
    },
    { status: 201 },
  );
}
