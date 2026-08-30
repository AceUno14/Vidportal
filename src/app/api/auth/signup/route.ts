import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAccessToken } from "@/lib/auth";
import { toLegacyRole } from "@/lib/prototype-compat";

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.email || !body.password || !body.name || !body.agencyName) {
    return NextResponse.json(
      { error: "name, email, password, and agencyName are required" },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email: body.email } });

  if (existingUser) {
    return NextResponse.json({ error: "an account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(body.password, 10);

  const slug = body.agencyName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const { workspace, user, membership } = await prisma.$transaction(
    async (transaction) => {
      const workspace = await transaction.workspace.create({
        data: { name: body.agencyName, slug },
      });
      const user = await transaction.user.create({
        data: {
          id: randomUUID(),
          email: body.email,
          name: body.name,
          passwordHash,
        },
      });
      const membership = await transaction.membership.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      return { workspace, user, membership };
    },
  );

  const token = createAccessToken({
    id: user.id,
    workspaceId: workspace.id,
    membershipId: membership.id,
    role: membership.role,
  });

  return NextResponse.json({
    accessToken: token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: toLegacyRole(membership.role),
    },
  });
}
