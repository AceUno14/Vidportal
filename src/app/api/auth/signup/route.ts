import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAccessToken } from "@/lib/auth";

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

  const agency = await prisma.agency.create({
    data: { name: body.agencyName, slug },
  });

  const user = await prisma.user.create({
    data: {
      agencyId: agency.id,
      email: body.email,
      name: body.name,
      passwordHash,
      role: "ADMIN",
    },
  });

  const token = createAccessToken({ id: user.id, agencyId: user.agencyId, role: user.role });

  return NextResponse.json({
    accessToken: token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
}