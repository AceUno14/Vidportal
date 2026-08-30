import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

const seedPath = path.join(process.cwd(), "prisma", "seed.ts");
const verificationPath = path.join(process.cwd(), "prisma", "verify.ts");

let seedSource = "";
let verificationSource = "";

beforeAll(async () => {
  [seedSource, verificationSource] = await Promise.all([
    readFile(seedPath, "utf8"),
    readFile(verificationPath, "utf8"),
  ]);
});

describe("canonical development seed contract", () => {
  it("exports a reusable seed operation with deterministic demo identifiers", () => {
    expect(seedSource).toMatch(/export\s+async\s+function\s+seedDatabase\b/);
    expect(seedSource).toMatch(/["']demo_[a-z0-9_]+["']/i);
    expect(seedSource).toMatch(/\$disconnect\s*\(/);
  });

  it("uses rerunnable writes for mutable and immutable demo records", () => {
    expect(seedSource).toMatch(/\.upsert\s*\(/);
    expect(seedSource).toMatch(/\.createMany\s*\(/);
    expect(seedSource).toMatch(/skipDuplicates\s*:\s*true/);
    expect(seedSource).not.toMatch(/\.deleteMany\s*\(/);
  });

  it("seeds stable Better Auth credential accounts without short-lived auth records", () => {
    expect(seedSource).toMatch(/\.account\.upsert\s*\(/i);
    expect(seedSource).toMatch(/issuer\s*:\s*["']local:credential["']/i);
    expect(seedSource).toMatch(/providerId\s*:\s*["']credential["']/i);
    expect(seedSource).toMatch(/password\s*:\s*DEMO_PASSWORD_HASH/i);
    expect(seedSource).not.toContain("VidPortalDemo123!");
    expect(seedSource).not.toMatch(/\.(?:session|verification)\s*\.(?:create|upsert)\s*\(/i);
  });

  it("provides a read-only canonical dataset verifier", () => {
    expect(verificationSource).toMatch(/export\s+async\s+function\s+\w+/);
    expect(verificationSource).toMatch(/import\s+\{\s*DEMO_IDS\s*\}\s+from\s+["']\.\/seed["']/);
    expect(verificationSource).toMatch(/startsWith\s*:\s*["']demo_["']/i);
    expect(verificationSource).not.toMatch(
      /\.(?:create|createMany|delete|deleteMany|update|updateMany|upsert)\s*\(/,
    );
  });
});
