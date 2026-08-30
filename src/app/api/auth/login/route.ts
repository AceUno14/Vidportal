import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAccessToken } from "@/lib/auth";
import { toLegacyRole } from "@/lib/prototype-compat";

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.email || !body.password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: body.email },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        orderBy: { joinedAt: "asc" },
        take: 1,
      },
    },
  });

  const membership = user?.memberships[0];

  if (!user || !membership || !user.passwordHash) {
    return NextResponse.json(
      { error: "invalid email or password" },
      { status: 401 }
    );
  }

  const passwordMatches = await bcrypt.compare(
    body.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    return NextResponse.json(
      { error: "invalid email or password" },
      { status: 401 }
    );
  }

  const token = createAccessToken({
    id: user.id,
    workspaceId: membership.workspaceId,
    membershipId: membership.id,
    role: membership.role,
    clientId: membership.clientId,
  });

  return NextResponse.json({
    accessToken: token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: toLegacyRole(membership.role),
      clientId: membership.clientId,
    },
  });
}
