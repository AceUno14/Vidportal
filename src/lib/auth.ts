import jwt from "jsonwebtoken";

export type AuthUser = {
  id: string;
  agencyId: string;
  role: "ADMIN" | "STAFF" | "CLIENT";
  clientId?: string | null;
};

export function createAccessToken(user: AuthUser) {
  return jwt.sign(user, process.env.JWT_SECRET ?? "development-secret", { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): AuthUser {
  return jwt.verify(token, process.env.JWT_SECRET ?? "development-secret") as AuthUser;
}