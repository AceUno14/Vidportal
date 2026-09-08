import { NextResponse } from "next/server";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { clientVisibleFileAssetWhere } from "@/features/files/policy";
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

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  clientName: z.string().trim().min(1).max(120),
  clientEmail: z.email().transform((email) => email.toLowerCase()),
});

/**
 * Only the fields the project-list file DTO needs. storageKey is deliberately
 * excluded so the raw storage location never leaves the server through this
 * route.
 */
const projectListFileAssetSelect = {
  id: true,
  projectId: true,
  originalFilename: true,
  contentType: true,
  kind: true,
  sizeBytes: true,
  durationSeconds: true,
  createdAt: true,
} satisfies Prisma.FileAssetSelect;

export async function GET(request: Request) {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Nested file visibility is authorized at the Prisma level: CLIENT users only
  // receive published final deliverables plus their own eligible SOURCE and
  // REFERENCE uploads, matching the dedicated file-list service. Workspace
  // managers and assigned members keep their existing project file list.
  const projects = await prisma.project.findMany({
    where: projectWhereForAuth(authUser),
    include: {
      client: true,
      fileAssets: {
        where:
          authUser.role === "CLIENT"
            ? clientVisibleFileAssetWhere(authUser.membershipId)
            : undefined,
        select: projectListFileAssetSelect,
        orderBy: { createdAt: "desc" },
      },
    },
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

  const parsed = createProjectSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid project name, client name, and client email are required." },
      { status: 400 }
    );
  }

  const { name, clientName, clientEmail } = parsed.data;
  const intakeTemplateVersion = await prisma.intakeTemplateVersion.findFirst({
    where: {
      workspaceId: authUser.workspaceId,
      publishedAt: { not: null },
      intakeTemplate: { active: true, archivedAt: null },
    },
    orderBy: { publishedAt: "desc" },
    select: { id: true },
  });

  if (!intakeTemplateVersion) {
    return NextResponse.json(
      { error: "Publish an intake template before creating a project." },
      { status: 409 },
    );
  }

  const project = await prisma.$transaction(async (transaction) => {
    let client = await transaction.client.findFirst({
      where: { workspaceId: authUser.workspaceId, email: clientEmail },
    });

    if (!client) {
      client = await transaction.client.create({
        data: {
          workspaceId: authUser.workspaceId,
          name: clientName,
          email: clientEmail,
        },
      });
    }

    const createdProject = await transaction.project.create({
      data: {
        workspaceId: authUser.workspaceId,
        clientId: client.id,
        intakeTemplateVersionId: intakeTemplateVersion.id,
        name,
        status: "INTAKE",
      },
      include: { client: true },
    });

    await transaction.activity.create({
      data: {
        workspaceId: authUser.workspaceId,
        projectId: createdProject.id,
        actorMembershipId: authUser.membershipId,
        action: "PROJECT_CREATED",
        entityType: "Project",
        entityId: createdProject.id,
        metadata: { status: "INTAKE" },
      },
    });

    return createdProject;
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
