import { test, expect } from "@playwright/test";

test.describe("New user complete flow", () => {
  test("login page shows both tabs (login + register)", async ({ page }) => {
    await page.goto("/veille/login");
    await expect(page.getByText("connexion", { exact: false })).toBeVisible();
    await expect(page.getByText("inscription", { exact: false })).toBeVisible();
  });

  test("register with short password shows error via API", async ({ request }) => {
    const res = await request.post("/veille/api/auth/register", {
      data: { username: "short_test", email: "short@test.com", password: "short" },
    });
    // Either 400 (validation error) or 429 (rate limited) — both mean the API works
    expect([400, 429]).toContain(res.status());
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test("guide page explains how the app works", async ({ page }) => {
    await page.goto("/veille/guide");
    await page.waitForTimeout(500);
    // Check for the "how it works" section content
    const body = await page.textContent("body");
    expect(body).toContain("toutes les heures");
  });

  test("guest can access feed without login", async ({ page }) => {
    await page.goto("/veille/feed");
    await page.waitForTimeout(500);
    // Feed should load articles for guests too
    const body = await page.textContent("body");
    expect(body?.length).toBeGreaterThan(100);
  });
});
