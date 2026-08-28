import { NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";

function getAuthUser(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");

  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const authUser = getAuthUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, fileId } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id,
      agencyId: authUser.agencyId,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const file = await prisma.file.findFirst({
    where: {
      id: fileId,
      projectId: id,
    },
  });

  if (!file) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  await prisma.file.delete({
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