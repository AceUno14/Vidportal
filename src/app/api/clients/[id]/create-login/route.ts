import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = getAuthUser(request);

  if (!authUser || authUser.role !== "ADMIN") {
    return NextResponse.json({ error: "only an admin can create client logins" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  if (!body.password || body.password.length < 8) {
    return NextResponse.json(
      { error: "a password of at least 8 characters is required" },
      { status: 400 }
    );
  }

  const client = await prisma.client.findFirst({
    where: { id, agencyId: authUser.agencyId },
  });

  if (!client) {
    return NextResponse.json({ error: "client not found" }, { status: 404 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: client.email } });

  if (existingUser) {
    return NextResponse.json(
      { error: "a login already exists for this email" },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(body.password, 10);

  const clientUser = await prisma.user.create({
    data: {
      agencyId: authUser.agencyId,
      clientId: client.id,
      email: client.email,
      name: client.name,
      passwordHash,
      role: "CLIENT",
    },
  });

  return NextResponse.json(
    { data: { id: clientUser.id, email: clientUser.email, name: clientUser.name } },
    { status: 201 }
  );
}