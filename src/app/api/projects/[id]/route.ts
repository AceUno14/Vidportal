import { NextResponse } from "next/server";
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

const VALID_STATUSES = [
  "BRIEFING",
  "IN_PROGRESS",
  "CLIENT_REVIEW",
  "REVISIONS",
  "FINAL_DELIVERY",
  "COMPLETED",
];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = getAuthUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, agencyId: authUser.agencyId },
    include: {
      client: true,
      files: true,
      invoices: true,
      comments: { include: { author: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const serialized = {
    ...project,
    files: project.files.map((file) => ({ ...file, sizeBytes: file.sizeBytes.toString() })),
  };

  return NextResponse.json({ data: serialized });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = getAuthUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "a valid status is required" }, { status: 400 });
  }

  const existing = await prisma.project.findFirst({
    where: { id, agencyId: authUser.agencyId },
  });

  if (!existing) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const project = await prisma.project.update({
    where: { id },
    data: { status: body.status },
    include: {
      client: true,
      files: true,
      invoices: true,
      comments: { include: { author: true }, orderBy: { createdAt: "desc" } },
    },
  });

  const serialized = {
    ...project,
    files: project.files.map((file) => ({ ...file, sizeBytes: file.sizeBytes.toString() })),
  };

  return NextResponse.json({ data: serialized });
}