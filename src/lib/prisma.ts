import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@/generated/prisma/wasm";
import { getDatabaseEnvironment } from "@/lib/env/server";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const { DATABASE_URL } = getDatabaseEnvironment();
  const adapter = new PrismaNeon({ connectionString: DATABASE_URL });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
