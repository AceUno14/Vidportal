import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
  getAuthUserFromRequest,
  isWorkspaceManager,
  projectWhereForAuth,
} from "@/server/authorization";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isWorkspaceManager(authUser)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id, fileId } = await params;

  const project = await prisma.project.findFirst({
    where: projectWhereForAuth(authUser, id),
  });

  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const file = await prisma.fileAsset.findFirst({
    where: {
      id: fileId,
      workspaceId: authUser.workspaceId,
      projectId: id,
    },
  });

  if (!file) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  await prisma.fileAsset.delete({
    where: { id: fileId },
  });

  try {
    const diskPath = path.join(process.cwd(), "public", file.storageKey);
    await unlink(diskPath);
  } catch {
    // File may already be missing from disk; the database record is what matters most.
  }

  return NextResponse.json({ data: { deleted: true } });
}
