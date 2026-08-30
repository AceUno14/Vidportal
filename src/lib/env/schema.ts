import { z } from "zod";

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

function usesProtocol(value: string, protocols: readonly string[]) {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const postgresUrl = z
  .string()
  .refine(
    (value) => usesProtocol(value, ["postgres:", "postgresql:"]),
    "Must be a PostgreSQL connection URL",
  );
const applicationUrl = z
  .string()
  .refine(
    (value) => usesProtocol(value, ["http:", "https:"]),
    "Must be an HTTP or HTTPS URL",
  );
const emailAddress = z.string().refine((value) => {
  const brandedAddress = value.match(/<([^<>]+)>\s*$/)?.[1];
  return z.email().safeParse(brandedAddress ?? value).success;
}, "Must contain a valid email address");
const positiveSeconds = z.coerce.number().int().positive().max(604_800);

export const databaseEnvironmentSchema = z.object({
  DATABASE_URL: postgresUrl,
  DIRECT_URL: postgresUrl,
  TEST_DATABASE_URL: postgresUrl.optional(),
});

export const authEnvironmentSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: applicationUrl,
});

export const r2EnvironmentSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_PRESIGNED_URL_TTL_SECONDS: positiveSeconds.default(900),
});

export const streamEnvironmentSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_STREAM_API_TOKEN: z.string().min(1),
  CLOUDFLARE_STREAM_CUSTOMER_CODE: z.string().min(1),
  CLOUDFLARE_STREAM_WEBHOOK_SECRET: z.string().min(1),
  STREAM_TOKEN_TTL_SECONDS: positiveSeconds.default(900),
});

export const emailEnvironmentSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: emailAddress,
  RESEND_REPLY_TO_EMAIL: z.email().optional(),
});

export const serverEnvironmentSchema = z.object({
  ...databaseEnvironmentSchema.shape,
  ...authEnvironmentSchema.shape,
  ...r2EnvironmentSchema.shape,
  ...streamEnvironmentSchema.shape,
  ...emailEnvironmentSchema.shape,
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type DatabaseEnvironment = z.infer<typeof databaseEnvironmentSchema>;
export type AuthEnvironment = z.infer<typeof authEnvironmentSchema>;
export type R2Environment = z.infer<typeof r2EnvironmentSchema>;
export type StreamEnvironment = z.infer<typeof streamEnvironmentSchema>;
export type EmailEnvironment = z.infer<typeof emailEnvironmentSchema>;
export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

function describeIssues(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");
}

function parseEnvironment<T>(
  schema: z.ZodType<T>,
  source: EnvironmentSource,
  dependency: string,
): T {
  const result = schema.safeParse(source);

  if (!result.success) {
    throw new Error(
      `Invalid ${dependency} environment: ${describeIssues(result.error)}`,
    );
  }

  return result.data;
}

export function parseDatabaseEnvironment(
  source: EnvironmentSource,
): DatabaseEnvironment {
  return parseEnvironment(databaseEnvironmentSchema, source, "database");
}

export function parseAuthEnvironment(
  source: EnvironmentSource,
): AuthEnvironment {
  return parseEnvironment(authEnvironmentSchema, source, "auth");
}

export function parseR2Environment(source: EnvironmentSource): R2Environment {
  return parseEnvironment(r2EnvironmentSchema, source, "R2");
}

export function parseStreamEnvironment(
  source: EnvironmentSource,
): StreamEnvironment {
  return parseEnvironment(streamEnvironmentSchema, source, "Stream");
}

export function parseEmailEnvironment(
  source: EnvironmentSource,
): EmailEnvironment {
  return parseEnvironment(emailEnvironmentSchema, source, "email");
}

export function parseServerEnvironment(
  source: EnvironmentSource,
): ServerEnvironment {
  return parseEnvironment(serverEnvironmentSchema, source, "server");
}
