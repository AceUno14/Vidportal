import jwt from "jsonwebtoken";

import type { CanonicalMembershipRole } from "@/lib/prototype-compat";

export type AuthUser = {
  id: string;
  workspaceId: string;
  membershipId: string;
  role: CanonicalMembershipRole;
  clientId?: string | null;
};

export function createAccessToken(user: AuthUser) {
  return jwt.sign(user, process.env.JWT_SECRET ?? "development-secret", { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): AuthUser {
  const payload = jwt.verify(
    token,
    process.env.JWT_SECRET ?? "development-secret",
  ) as Partial<AuthUser>;

  if (
    !payload.id ||
    !payload.workspaceId ||
    !payload.membershipId ||
    !payload.role
  ) {
    throw new Error("Invalid prototype access token");
  }

  return payload as AuthUser;
}

export function getAuthUserFromRequest(request: Request): AuthUser | null {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  try {
    return verifyAccessToken(authHeader.slice("Bearer ".length));
  } catch {
    return null;
  }
}
