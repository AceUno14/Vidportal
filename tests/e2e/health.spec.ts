import { expect, test } from "@playwright/test";

test("the deployed application reports healthy", async ({ request }) => {
  const response = await request.get("/api/health");
  const body = (await response.json()) as Record<string, unknown>;

  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(body).toEqual({
    service: "vidportal",
    status: "ok",
    timestamp: expect.any(String),
  });
  expect(Number.isNaN(Date.parse(body.timestamp as string))).toBe(false);
});
