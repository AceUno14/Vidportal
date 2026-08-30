import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma CLI operations use Neon's direct endpoint. The application runtime
    // uses the pooled DATABASE_URL through the Neon serverless adapter.
    url: env("DIRECT_URL"),
  },
});
