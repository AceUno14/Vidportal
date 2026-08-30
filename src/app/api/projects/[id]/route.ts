import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  toCanonicalProjectStatus,
  toLegacyClient,
  toLegacyFileAsset,
  toLegacyProject,
  toLegacyRole,
  type LegacyProjectStatus,
} from "@/lib/prototype-compat";
import {
  getAuthUserFromRequest,
  projectWhereForAuth,
  type AuthUser,
} from "@/server/authorization";

const VALID_STATUSES = [
  "BRIEFING",
  "IN_PROGRESS",
  "CLIENT_REVIEW",
  "REVISIONS",
  "FINAL_DELIVERY",
  "COMPLETED",
] satisfies LegacyProjectStatus[];

const projectDetails = {
  client: true,
  fileAssets: true,
  comments: {
    include: { author: { include: { user: true } } },
    orderBy: { createdAt: "desc" as const },
  },
};

type ProjectDetails = Awaited<
  ReturnType<typeof findPrototypeProject>
> extends infer Project
  ? Exclude<Project, null>
  : never;

function findPrototypeProject(id: string, authUser: AuthUser) {
  return prisma.project.findFirst({
    where: projectWhereForAuth(authUser, id),
    include: projectDetails,
  });
}

function serializeProject(project: ProjectDetails) {
  return {
    ...toLegacyProject(project),
    client: toLegacyClient(project.client),
    files: project.fileAssets.map(toLegacyFileAsset),
    invoices: [],
    comments: project.comments.map((comment) => ({
      id: comment.id,
      projectId: comment.projectId,
      authorId: comment.author.userId,
      body: comment.body,
      timestampSeconds: comment.timestampSeconds,
      resolved: comment.resolvedAt !== null,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
      author: {
        id: comment.author.user.id,
        agencyId: comment.author.workspaceId,
        email: comment.author.user.email,
        name: comment.author.user.name,
        role: toLegacyRole(comment.author.role),
        clientId: comment.author.clientId,
        avatarUrl: comment.author.user.image,
        createdAt: comment.author.user.createdAt,
        updatedAt: comment.author.user.updatedAt,
      },
    })),
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const project = await findPrototypeProject(id, authUser);

  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  return NextResponse.json({ data: serializeProject(project) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (authUser.role === "CLIENT") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "a valid status is required" }, { status: 400 });
  }

  const existing = await prisma.project.findFirst({
    where: projectWhereForAuth(authUser, id),
  });

  if (!existing) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const project = await prisma.project.update({
    where: { id },
    data: {
      status: toCanonicalProjectStatus(body.status as LegacyProjectStatus),
    },
    include: projectDetails,
  });

  return NextResponse.json({ data: serializeProject(project) });
}
