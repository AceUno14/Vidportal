import { describe, expect, it, vi } from "vitest";

import { parseServerEnvironment } from "@/lib/env/schema";

vi.mock("server-only", () => ({}));

const validEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:password@pooler.example.com/vidportal",
  DIRECT_URL: "postgresql://user:password@direct.example.com/vidportal",
  BETTER_AUTH_SECRET: "a-secure-development-secret-with-32-characters",
  BETTER_AUTH_URL: "http://localhost:3000",
  CLOUDFLARE_ACCOUNT_ID: "account-id",
  R2_BUCKET_NAME: "vidportal-development",
  R2_ACCESS_KEY_ID: "r2-access-key",
  R2_SECRET_ACCESS_KEY: "r2-secret-key",
  CLOUDFLARE_STREAM_API_TOKEN: "stream-api-token",
  CLOUDFLARE_STREAM_CUSTOMER_CODE: "customer-code",
  CLOUDFLARE_STREAM_WEBHOOK_SECRET: "webhook-secret",
  RESEND_API_KEY: "re_test_key",
  RESEND_FROM_EMAIL: "VidPortal <noreply@example.com>",
};

describe("server environment validation", () => {
  it("gets the database environment without unrelated credentials", async () => {
    const originalEnvironment = process.env;

    process.env = {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/vidportal",
      DIRECT_URL: "postgresql://postgres:postgres@localhost:5432/vidportal",
    };

    try {
      vi.resetModules();
      const { getDatabaseEnvironment } = await import("@/lib/env/server");

      expect(getDatabaseEnvironment()).toEqual({
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/vidportal",
        DIRECT_URL: "postgresql://postgres:postgres@localhost:5432/vidportal",
      });
    } finally {
      process.env = originalEnvironment;
      vi.resetModules();
    }
  });

  it("accepts the complete environment and applies safe defaults", () => {
    const environment = parseServerEnvironment(validEnvironment);

    expect(environment.LOG_LEVEL).toBe("info");
    expect(environment.R2_PRESIGNED_URL_TTL_SECONDS).toBe(900);
    expect(environment.STREAM_TOKEN_TTL_SECONDS).toBe(900);
  });

  it("reports a missing required variable by name without printing secrets", () => {
    const invalidEnvironment = { ...validEnvironment };
    delete invalidEnvironment.R2_SECRET_ACCESS_KEY;

    expect(() => parseServerEnvironment(invalidEnvironment)).toThrow(
      /R2_SECRET_ACCESS_KEY/,
    );
  });

  it("reports malformed URLs as validation errors", () => {
    expect(() =>
      parseServerEnvironment({
        ...validEnvironment,
        DATABASE_URL: "not-a-url",
      }),
    ).toThrow(/Invalid server environment: DATABASE_URL/);
  });
});
