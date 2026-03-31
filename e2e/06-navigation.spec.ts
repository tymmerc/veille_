import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("bookmarks page loads", async ({ page }) => {
    await page.goto("/veille/bookmarks");
    await page.waitForTimeout(2000);
    // Should show something (bookmarks or redirect to login)
    expect(page.url()).toMatch(/\/(bookmarks|login)/);
  });

  test("404 for unknown routes", async ({ page }) => {
    const response = await page.goto("/veille/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
  });
});
