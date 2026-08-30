/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";

import { GET } from "../../src/app/api/health/route";

describe("GET /api/health", () => {
  it("returns the stable service health contract", async () => {
    const response = GET();
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      service: "vidportal",
      status: "ok",
      timestamp: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(body.timestamp as string))).toBe(false);
  });
});
