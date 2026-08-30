import { readFile } from "node:fs/promises";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
const prismaConfigPath = path.join(process.cwd(), "prisma.config.ts");

let schema = "";
let prismaConfig = "";

function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function block(kind: "datasource" | "enum" | "generator" | "model", name: string) {
  const expression = new RegExp(
    `(?:^|\\r?\\n)${kind}\\s+${escapeRegularExpression(name)}\\s*\\{([\\s\\S]*?)\\r?\\n\\}`,
  );
  const match = expression.exec(schema);

  expect(match, `Expected ${kind} ${name} in prisma/schema.prisma`).not.toBeNull();
  return match?.[1] ?? "";
}

function normalized(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function expectFields(modelName: string, fields: string[]) {
  const model = block("model", modelName);

  for (const field of fields) {
    expect(
      new RegExp(`^\\s*${escapeRegularExpression(field)}\\s+`, "m").test(model),
      `Expected ${modelName}.${field}`,
    ).toBe(true);
  }
}

function expectCompoundAttribute(
  modelName: string,
  attribute: "index" | "unique",
  fields: string[],
) {
  const model = normalized(block("model", modelName));
  const fieldList = fields.map(escapeRegularExpression).join("\\s*,\\s*");

  expect(
    new RegExp(`@@${attribute}\\(\\[${fieldList}\\](?:\\s*,|\\))`).test(model),
    `Expected ${modelName} to have @@${attribute}([${fields.join(", ")}])`,
  ).toBe(true);
}

function expectIndexLeadingWith(modelName: string, field: string) {
  const model = normalized(block("model", modelName));

  expect(
    new RegExp(
      `@@index\\(\\[\\s*${escapeRegularExpression(field)}(?:\\s*,|\\s*\\])`,
    ).test(model),
    `Expected ${modelName} to have an index led by ${field}`,
  ).toBe(true);
}

function hasSingleFieldUnique(modelName: string, field: string) {
  const model = block("model", modelName);
  const fieldDeclaration = new RegExp(
    `^\\s*${escapeRegularExpression(field)}\\s+[^\\r\\n]*\\s@unique(?:\\s|$)`,
    "m",
  );
  const modelAttribute = new RegExp(
    `@@unique\\(\\[${escapeRegularExpression(field)}\\](?:\\s*,|\\))`,
  );

  return fieldDeclaration.test(model) || modelAttribute.test(normalized(model));
}

function expectSingleFieldUnique(modelName: string, field: string) {
  expect(
    hasSingleFieldUnique(modelName, field),
    `Expected ${modelName}.${field} to be unique`,
  ).toBe(true);
}

function enumValues(name: string) {
  return block("enum", name)
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter(Boolean);
}

beforeAll(async () => {
  [schema, prismaConfig] = await Promise.all([
    readFile(schemaPath, "utf8"),
    readFile(prismaConfigPath, "utf8"),
  ]);
});

describe("Prisma 7 database foundation", () => {
  it("uses the generated Prisma client and PostgreSQL boundaries", () => {
    const generator = normalized(block("generator", "client"));
    const datasource = normalized(block("datasource", "db"));

    expect(generator).toContain('provider = "prisma-client"');
    expect(generator).toContain('output = "../src/generated/prisma"');
    expect(datasource).toContain('provider = "postgresql"');
    expect(datasource).not.toMatch(/\burl\s*=/);
    expect(prismaConfig).toMatch(/\bDIRECT_URL\b/);
  });

  it("replaces the prototype tenant root and preserves the locked workflow", () => {
    expect(schema).not.toMatch(/(?:^|\n)model\s+Agency\s*\{/);
    expect(enumValues("MembershipRole")).toEqual([
      "OWNER",
      "ADMIN",
      "MEMBER",
      "CLIENT",
    ]);
    expect(enumValues("ProjectStatus")).toEqual([
      "INTAKE",
      "READY",
      "IN_PROGRESS",
      "CLIENT_REVIEW",
      "REVISIONS",
      "FINAL_DELIVERY",
      "COMPLETED",
    ]);
    expect(enumValues("ApprovalDecision")).toEqual([
      "APPROVED",
      "CHANGES_REQUESTED",
    ]);
  });
});

describe("Better Auth core data-model contract", () => {
  it("keeps identity global and includes the required User fields", () => {
    expectFields("User", [
      "id",
      "name",
      "email",
      "emailVerified",
      "image",
      "createdAt",
      "updatedAt",
    ]);

    const user = normalized(block("model", "User"));
    expectSingleFieldUnique("User", "email");
    expect(user).toContain('@@map("user")');
    expect(user).not.toMatch(/\bworkspaceId\b/);
    expect(user).not.toMatch(/\bagencyId\b/);
  });

  it("defines database-backed sessions with their uniqueness and lookup index", () => {
    expectFields("Session", [
      "id",
      "expiresAt",
      "token",
      "createdAt",
      "updatedAt",
      "ipAddress",
      "userAgent",
      "userId",
    ]);

    const session = normalized(block("model", "Session"));
    expectSingleFieldUnique("Session", "token");
    expectIndexLeadingWith("Session", "userId");
    expect(session).toContain("fields: [userId], references: [id], onDelete: Cascade");
    expect(session).toContain('@@map("session")');
  });

  it("uses issuer-scoped account identity and retains sensitive token fields", () => {
    expectFields("Account", [
      "id",
      "issuer",
      "accountId",
      "providerId",
      "userId",
      "accessToken",
      "refreshToken",
      "idToken",
      "accessTokenExpiresAt",
      "refreshTokenExpiresAt",
      "scope",
      "password",
      "createdAt",
      "updatedAt",
    ]);

    const account = normalized(block("model", "Account"));
    expectCompoundAttribute("Account", "unique", ["issuer", "accountId"]);
    expectCompoundAttribute("Account", "index", ["userId"]);
    expect(account).toContain("fields: [userId], references: [id], onDelete: Cascade");
    expect(account).toContain('@@map("account")');
    expect(account).not.toContain("@@unique([providerId, accountId])");
  });

  it("indexes reusable verification identifiers without making them unique", () => {
    expectFields("Verification", [
      "id",
      "identifier",
      "value",
      "expiresAt",
      "createdAt",
      "updatedAt",
    ]);

    const verification = normalized(block("model", "Verification"));
    expectCompoundAttribute("Verification", "index", ["identifier"]);
    expect(hasSingleFieldUnique("Verification", "identifier")).toBe(false);
    expect(verification).toContain('@@map("verification")');
  });
});

describe("workspace tenant-isolation schema contract", () => {
  const tenantModels = [
    "Membership",
    "Client",
    "Project",
    "ProjectAssignment",
    "IntakeTemplate",
    "IntakeTemplateVersion",
    "IntakeSubmission",
    "FileAsset",
    "UploadSession",
    "ReviewVersion",
    "Comment",
    "Approval",
    "Activity",
  ];

  it.each(tenantModels)("gives %s a direct workspace key", (modelName) => {
    expectFields(modelName, ["workspaceId"]);
    expectCompoundAttribute(modelName, "unique", ["workspaceId", "id"]);
  });

  it("prevents duplicate memberships and cross-workspace client links", () => {
    expectFields("Membership", [
      "workspaceId",
      "userId",
      "clientId",
      "role",
      "status",
      "deactivatedAt",
    ]);

    const membership = normalized(block("model", "Membership"));
    expectCompoundAttribute("Membership", "unique", ["workspaceId", "userId"]);
    expect(membership).toContain(
      "fields: [workspaceId, clientId], references: [workspaceId, id]",
    );
  });

  it("binds projects and assignments to same-workspace parents", () => {
    const project = normalized(block("model", "Project"));
    const assignment = normalized(block("model", "ProjectAssignment"));

    expect(project).toContain(
      "fields: [workspaceId, clientId], references: [workspaceId, id]",
    );
    expect(assignment).toContain(
      "fields: [workspaceId, projectId], references: [workspaceId, id]",
    );
    expect(assignment).toContain(
      "fields: [workspaceId, membershipId], references: [workspaceId, id]",
    );
    expectCompoundAttribute("ProjectAssignment", "unique", [
      "workspaceId",
      "projectId",
      "membershipId",
    ]);
  });

  it("binds immutable intake snapshots to same-workspace parents", () => {
    const templateVersion = normalized(block("model", "IntakeTemplateVersion"));
    const submission = normalized(block("model", "IntakeSubmission"));

    expect(templateVersion).toContain(
      "fields: [workspaceId, intakeTemplateId], references: [workspaceId, id]",
    );
    expect(templateVersion).toContain(
      "fields: [workspaceId, createdByMembershipId], references: [workspaceId, id]",
    );
    expect(submission).toContain(
      "fields: [workspaceId, projectId], references: [workspaceId, id]",
    );
    expect(submission).toContain(
      "fields: [workspaceId, intakeTemplateVersionId], references: [workspaceId, id]",
    );
    expect(submission).toContain(
      "fields: [workspaceId, submittedByMembershipId], references: [workspaceId, id]",
    );
    expect(submission).toContain(
      "fields: [workspaceId, projectId, reopenedFromId], references: [workspaceId, projectId, id]",
    );
    expectCompoundAttribute("IntakeSubmission", "unique", [
      "workspaceId",
      "projectId",
      "sequence",
    ]);
  });

  it("binds file metadata to the authorized project and uploader", () => {
    const fileAsset = normalized(block("model", "FileAsset"));

    expect(fileAsset).toContain(
      "fields: [workspaceId, projectId], references: [workspaceId, id]",
    );
    expect(fileAsset).toContain(
      "fields: [workspaceId, uploadedByMembershipId], references: [workspaceId, id]",
    );
    expectCompoundAttribute("FileAsset", "unique", [
      "workspaceId",
      "projectId",
      "id",
    ]);
  });

  it("records the complete authorized upload-session envelope", () => {
    expectFields("UploadSession", [
      "workspaceId",
      "projectId",
      "uploadedByMembershipId",
      "fileAssetId",
      "expectedFilename",
      "expectedByteSize",
      "expectedContentType",
      "storageKey",
      "providerUploadId",
      "uploadType",
      "status",
      "createdAt",
      "expiresAt",
      "completedAt",
      "abortedAt",
    ]);

    const uploadSession = normalized(block("model", "UploadSession"));
    expect(uploadSession).toContain(
      "fields: [workspaceId, projectId], references: [workspaceId, id]",
    );
    expect(uploadSession).toContain(
      "fields: [workspaceId, uploadedByMembershipId], references: [workspaceId, id]",
    );
    expect(uploadSession).toContain(
      "fields: [workspaceId, projectId, fileAssetId], references: [workspaceId, projectId, id]",
    );
    expectCompoundAttribute("UploadSession", "unique", [
      "workspaceId",
      "projectId",
      "fileAssetId",
    ]);
  });

  it("scopes review versions and immutable decisions to one project version", () => {
    expectFields("ReviewVersion", [
      "workspaceId",
      "projectId",
      "version",
      "streamUid",
      "declaredFilename",
      "declaredByteSize",
      "declaredContentType",
      "maxDurationSeconds",
      "requiresSignedUrls",
      "status",
    ]);

    const reviewVersion = normalized(block("model", "ReviewVersion"));
    const approval = normalized(block("model", "Approval"));
    expect(reviewVersion).toContain(
      "fields: [workspaceId, projectId], references: [workspaceId, id]",
    );
    expect(reviewVersion).toContain(
      "fields: [workspaceId, createdByMembershipId], references: [workspaceId, id]",
    );
    expect(reviewVersion).toContain(
      "fields: [workspaceId, projectId, sourceFileAssetId], references: [workspaceId, projectId, id]",
    );
    expectCompoundAttribute("ReviewVersion", "unique", [
      "workspaceId",
      "projectId",
      "version",
    ]);
    expectCompoundAttribute("ReviewVersion", "unique", [
      "workspaceId",
      "projectId",
      "id",
    ]);
    expectCompoundAttribute("Approval", "unique", [
      "workspaceId",
      "reviewVersionId",
    ]);
    expect(approval).toContain(
      "fields: [workspaceId, projectId, reviewVersionId], references: [workspaceId, projectId, id]",
    );
    expect(approval).toContain(
      "fields: [workspaceId, decidedByMembershipId], references: [workspaceId, id]",
    );
    expect(approval).not.toMatch(/\bupdatedAt\b/);
  });

  it("keeps comments inside their review-version and author tenant chain", () => {
    const comment = normalized(block("model", "Comment"));

    expect(comment).toContain(
      "fields: [workspaceId, projectId, reviewVersionId], references: [workspaceId, projectId, id]",
    );
    expect(comment).toContain(
      "fields: [workspaceId, authorMembershipId], references: [workspaceId, id]",
    );
    expect(comment).toContain(
      "fields: [workspaceId, reviewVersionId, parentId], references: [workspaceId, reviewVersionId, id]",
    );
    expectCompoundAttribute("Comment", "unique", [
      "workspaceId",
      "reviewVersionId",
      "id",
    ]);
  });

  it("keeps Activity append-oriented at the schema boundary", () => {
    expectFields("Activity", [
      "workspaceId",
      "action",
      "entityType",
      "entityId",
      "metadata",
      "createdAt",
    ]);

    const activity = normalized(block("model", "Activity"));
    expect(activity).toContain(
      "fields: [workspaceId, projectId], references: [workspaceId, id]",
    );
    expect(activity).toContain(
      "fields: [workspaceId, actorMembershipId], references: [workspaceId, id]",
    );
    expectCompoundAttribute("Activity", "index", ["workspaceId", "createdAt"]);
    expect(activity).not.toMatch(/\bupdatedAt\b/);
    expect(activity).not.toMatch(/\bdeletedAt\b/);
  });
});
