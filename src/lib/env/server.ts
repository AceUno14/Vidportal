import "server-only";

import {
  parseAuthEnvironment,
  parseDatabaseEnvironment,
  parseEmailEnvironment,
  parseR2Environment,
  parseServerEnvironment,
  parseStreamEnvironment,
  type AuthEnvironment,
  type DatabaseEnvironment,
  type EmailEnvironment,
  type R2Environment,
  type ServerEnvironment,
  type StreamEnvironment,
} from "./schema";

let cachedDatabaseEnvironment: DatabaseEnvironment | undefined;
let cachedAuthEnvironment: AuthEnvironment | undefined;
let cachedR2Environment: R2Environment | undefined;
let cachedStreamEnvironment: StreamEnvironment | undefined;
let cachedEmailEnvironment: EmailEnvironment | undefined;
let cachedEnvironment: ServerEnvironment | undefined;

export function getDatabaseEnvironment(): DatabaseEnvironment {
  cachedDatabaseEnvironment ??= parseDatabaseEnvironment(process.env);
  return cachedDatabaseEnvironment;
}

export function getAuthEnvironment(): AuthEnvironment {
  cachedAuthEnvironment ??= parseAuthEnvironment(process.env);
  return cachedAuthEnvironment;
}

export function getR2Environment(): R2Environment {
  cachedR2Environment ??= parseR2Environment(process.env);
  return cachedR2Environment;
}

export function getStreamEnvironment(): StreamEnvironment {
  cachedStreamEnvironment ??= parseStreamEnvironment(process.env);
  return cachedStreamEnvironment;
}

export function getEmailEnvironment(): EmailEnvironment {
  cachedEmailEnvironment ??= parseEmailEnvironment(process.env);
  return cachedEmailEnvironment;
}

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= parseServerEnvironment(process.env);
  return cachedEnvironment;
}
