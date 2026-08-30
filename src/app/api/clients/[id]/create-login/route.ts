import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import {
  getAuthUserFromRequest,
  isWorkspaceManager,
} from "@/server/authorization";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUserFromRequest(request);

  if (!authUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!isWorkspaceManager(authUser)) {
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
    where: { id, workspaceId: authUser.workspaceId },
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

  const passwordHash = await hashPassword(body.password);

  const clientUser = await prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        id: randomUUID(),
        email: client.email,
        name: client.name,
      },
    });

    await transaction.account.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        issuer: "local:credential",
        accountId: user.id,
        providerId: "credential",
        password: passwordHash,
      },
    });

    await transaction.membership.create({
      data: {
        workspaceId: authUser.workspaceId,
        userId: user.id,
        clientId: client.id,
        role: "CLIENT",
      },
    });

    return user;
  });

  return NextResponse.json(
    { data: { id: clientUser.id, email: clientUser.email, name: clientUser.name } },
    { status: 201 }
  );
}
