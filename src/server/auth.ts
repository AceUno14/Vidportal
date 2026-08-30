import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";

import { getAuthEnvironment } from "@/lib/env/server";
import { prisma } from "@/lib/prisma";

const environment = getAuthEnvironment();

export const auth = betterAuth({
  appName: "VidPortal",
  baseURL: environment.BETTER_AUTH_URL,
  secret: environment.BETTER_AUTH_SECRET,
  trustedOrigins: [environment.BETTER_AUTH_URL],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  session: {
    additionalFields: {
      activeWorkspaceId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const membership = await prisma.membership.findFirst({
            where: {
              userId: session.userId,
              status: "ACTIVE",
              deactivatedAt: null,
              workspace: { archivedAt: null },
            },
            orderBy: { joinedAt: "asc" },
            select: { workspaceId: true },
          });

          if (!membership) {
            return false;
          }

          return {
            data: {
              ...session,
              activeWorkspaceId: membership.workspaceId,
            },
          };
        },
      },
    },
  },
  advanced: {
    database: {
      joins: true,
    },
  },
});
