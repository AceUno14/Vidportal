import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
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

function kindFromMimeType(mimeType: string): "VIDEO" | "IMAGE" | "DOCUMENT" | "OTHER" {
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType === "application/pdf" || mimeType.includes("document")) return "DOCUMENT";
  return "OTHER";
}

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB limit for now

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: {
      id,
      agencyId: authUser.agencyId,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "no file was provided" }, { status: 400 });
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "file is too large. 25MB limit for now." },
      { status: 400 }
    );
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", id);
  await mkdir(uploadDir, { recursive: true });

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const fileName = `${Date.now()}-${safeName}`;
  const filePath = path.join(uploadDir, fileName);
  const publicPath = `/uploads/${id}/${fileName}`;

  const bytes = await file.arrayBuffer();
  await writeFile(filePath, Buffer.from(bytes));

  const savedFile = await prisma.file.create({
    data: {
      projectId: id,
      name: file.name,
      storageKey: publicPath,
      mimeType: file.type || "application/octet-stream",
      kind: kindFromMimeType(file.type || ""),
      sizeBytes: BigInt(file.size),
    },
  });

  return NextResponse.json(
    {
      data: {
        ...savedFile,
        sizeBytes: savedFile.sizeBytes.toString(),
      },
    },
    { status: 201 }
  );
}