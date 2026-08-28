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

  if (authUser.role === "CLIENT") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const clients = await prisma.client.findMany({
    where: { agencyId: authUser.agencyId },
    include: { _count: { select: { projects: true, users: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: clients });
}

export async function POST(request: Request) {
  const authUser = getAuthUser(request);

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
    where: { agencyId: authUser.agencyId, email: body.email },
  });

  if (existing) {
    return NextResponse.json({ error: "a client with this email already exists" }, { status: 409 });
  }

  const client = await prisma.client.create({
    data: {
      agencyId: authUser.agencyId,
      name: body.name,
      email: body.email,
      company: body.company || null,
    },
  });

  return NextResponse.json({ data: client }, { status: 201 });
}
