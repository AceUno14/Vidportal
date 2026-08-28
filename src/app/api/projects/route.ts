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

export async function GET(request: Request) {
  const authUser = getAuthUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { agencyId: authUser.agencyId },
    include: { client: true, files: true },
    orderBy: { createdAt: "desc" },
  });

  const serialized = projects.map((project) => ({
    ...project,
    files: project.files.map((file) => ({
      ...file,
      sizeBytes: file.sizeBytes.toString(),
    })),
  }));

  return NextResponse.json({ data: serialized });
}

export async function POST(request: Request) {
  const authUser = getAuthUser(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.name || !body.clientName || !body.clientEmail) {
    return NextResponse.json(
      { error: "name, clientName, and clientEmail are required" },
      { status: 400 }
    );
  }

  let client = await prisma.client.findFirst({
    where: { agencyId: authUser.agencyId, email: body.clientEmail },
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        agencyId: authUser.agencyId,
        name: body.clientName,
        email: body.clientEmail,
      },
    });
  }

  const project = await prisma.project.create({
    data: {
      agencyId: authUser.agencyId,
      clientId: client.id,
      name: body.name,
      status: "BRIEFING",
    },
    include: { client: true },
  });

  return NextResponse.json({ data: project }, { status: 201 });
}