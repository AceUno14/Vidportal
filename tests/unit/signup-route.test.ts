/**
 * Focused regression coverage for the signup route's database-failure branch:
 * a failing existing-user lookup must produce the generic 500 response without
 * leaking database or infrastructure error details to the client.
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../../src/app/api/auth/signup/route";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  signInEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
  },
}));

vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      signInEmail: mocks.signInEmail,
    },
  },
}));

const DATABASE_FAILURE = new Error(
  "ECONNREFUSED db.internal.host:5432 - getaddrinfo ENOTFOUND db.internal",
);

function signupRequest() {
  return new Request("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "New Owner",
      email: "Owner@Example.com",
      password: "correct-horse-battery",
      agencyName: "Acme Films",
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/signup database-failure handling", () => {
  it("handles a failing existing-user lookup and returns the generic 500 response without infrastructure details", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.userFindUnique.mockRejectedValue(DATABASE_FAILURE);

    const response = await POST(signupRequest());
    const body = (await response.json()) as { error?: string };

    expect(mocks.userFindUnique).toHaveBeenCalledTimes(1);
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { email: "owner@example.com" },
    });
    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: "Could not create your account. Please try again.",
    });
    expect(Object.keys(body)).toEqual(["error"]);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("ECONNREFUSED");
    expect(serialized).not.toContain("db.internal");
    expect(serialized).not.toContain(DATABASE_FAILURE.message);
    expect(mocks.signInEmail).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "[signup] Could not check for an existing account",
      DATABASE_FAILURE,
    );
    consoleError.mockRestore();
  });
});