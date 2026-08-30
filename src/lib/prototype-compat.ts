/**
 * Temporary adapters that keep the prototype API/UI contract stable while the
 * database uses the canonical Phase 2 vocabulary. These can be removed when
 * the prototype UI adopts the canonical project and file response shapes.
 */

export type CanonicalMembershipRole = "OWNER" | "ADMIN" | "MEMBER" | "CLIENT";

export type LegacyProjectStatus =
  | "BRIEFING"
  | "IN_PROGRESS"
  | "CLIENT_REVIEW"
  | "REVISIONS"
  | "FINAL_DELIVERY"
  | "COMPLETED";

export type CanonicalProjectStatus =
  | "INTAKE"
  | "READY"
  | "IN_PROGRESS"
  | "CLIENT_REVIEW"
  | "REVISIONS"
  | "FINAL_DELIVERY"
  | "COMPLETED";

export function toLegacyRole(role: CanonicalMembershipRole) {
  if (role === "OWNER") return "ADMIN" as const;
  if (role === "MEMBER") return "STAFF" as const;
  return role;
}

export function toLegacyProjectStatus(
  status: CanonicalProjectStatus,
): LegacyProjectStatus {
  return status === "INTAKE" || status === "READY" ? "BRIEFING" : status;
}

export function toCanonicalProjectStatus(
  status: LegacyProjectStatus,
): CanonicalProjectStatus {
  return status === "BRIEFING" ? "INTAKE" : status;
}

type FileAssetForPrototype = {
  id: string;
  projectId: string;
  originalFilename: string;
  storageKey: string;
  contentType: string;
  kind: "VIDEO" | "AUDIO" | "IMAGE" | "DOCUMENT" | "ARCHIVE" | "OTHER";
  sizeBytes: bigint;
  durationSeconds: number | null;
  createdAt: Date;
};

export function toLegacyFileAsset(file: FileAssetForPrototype) {
  return {
    id: file.id,
    projectId: file.projectId,
    name: file.originalFilename,
    storageKey: file.storageKey,
    mimeType: file.contentType,
    kind: file.kind,
    sizeBytes: file.sizeBytes.toString(),
    durationSeconds: file.durationSeconds,
    version: 1,
    createdAt: file.createdAt,
  };
}

type ProjectForPrototype = {
  id: string;
  workspaceId: string;
  clientId: string;
  name: string;
  type: string | null;
  status: CanonicalProjectStatus;
  deliveryDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toLegacyProject(project: ProjectForPrototype) {
  return {
    id: project.id,
    agencyId: project.workspaceId,
    clientId: project.clientId,
    name: project.name,
    type: project.type,
    status: toLegacyProjectStatus(project.status),
    deliveryDate: project.deliveryDate,
    budgetCents: null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

type ClientForPrototype = {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  company: string | null;
  createdAt: Date;
};

export function toLegacyClient(client: ClientForPrototype) {
  return {
    id: client.id,
    agencyId: client.workspaceId,
    name: client.name,
    email: client.email,
    company: client.company,
    createdAt: client.createdAt,
  };
}
