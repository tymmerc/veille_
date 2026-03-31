import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("Mobile experience", () => {
  test("feed loads on mobile", async ({ page }) => {
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });
  });

  test("tabs exist on mobile", async ({ page }) => {
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });

    for (const label of ["Pour toi", "Sources", "Amis", "Explorer"]) {
      await expect(page.getByRole("button", { name: label })).toBeAttached();
    }
  });

  test("article cards fit mobile width", async ({ page }) => {
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });

    const card = page.locator("[data-article-id]").first();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(400);
    }
  });

  test("login page is usable on mobile", async ({ page }) => {
    await page.goto("/veille/login");
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });
});
