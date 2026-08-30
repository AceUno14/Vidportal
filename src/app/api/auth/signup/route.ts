import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { auth } from "@/server/auth";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
  agencyName: z.string().trim().min(1).max(100),
});

function workspaceSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "valid name, email, password, and agencyName are required" },
      { status: 400 },
    );
  }

  const { name, email, password, agencyName } = parsed.data;
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return NextResponse.json(
      { error: "an account with this email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const baseSlug = workspaceSlug(agencyName) || "workspace";
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { slug: baseSlug },
    select: { id: true },
  });
  const slug = existingWorkspace
    ? `${baseSlug}-${randomUUID().slice(0, 8)}`
    : baseSlug;

  await prisma.$transaction(async (transaction) => {
    const workspace = await transaction.workspace.create({
      data: { name: agencyName, slug },
    });
    const user = await transaction.user.create({
      data: {
        id: randomUUID(),
        email,
        name,
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
        workspaceId: workspace.id,
        userId: user.id,
        role: "OWNER",
      },
    });
  });

  return auth.api.signInEmail({
    body: { email, password, rememberMe: true },
    headers: request.headers,
    asResponse: true,
  });
}
