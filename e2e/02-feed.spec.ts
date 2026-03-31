import { test, expect } from "@playwright/test";

test.describe("Feed experience (guest)", () => {
  test("feed loads articles", async ({ page }) => {
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });
    const count = await page.locator("[data-article-id]").count();
    expect(count).toBeGreaterThan(3);
  });

  test("tabs are visible and clickable", async ({ page }) => {
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });

    for (const label of ["Pour toi", "Sources", "Amis", "Explorer"]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }

    await page.getByRole("button", { name: "Explorer" }).click();
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 5000 });
  });

  test("search filters articles", async ({ page }) => {
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });

    const totalBefore = await page.locator("[data-article-id]").count();
    // Use a very specific term unlikely to match all articles
    await page.getByPlaceholder(/rechercher/i).fill("xyznotexist");
    await page.waitForTimeout(500);
    const totalAfter = await page.locator("[data-article-id]").count();
    expect(totalAfter).toBe(0);

    await page.getByPlaceholder(/rechercher/i).fill("");
    await page.waitForTimeout(500);
    const totalRestored = await page.locator("[data-article-id]").count();
    expect(totalRestored).toBe(totalBefore);
  });

  test("advanced filters panel toggles", async ({ page }) => {
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });

    // Open filters
    await page.getByRole("button", { name: /filtres/i }).click();
    // Check filter buttons exist
    await expect(page.getByRole("button", { name: "Reddit", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "HN", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "9+" })).toBeVisible();

    // Close filters
    await page.getByRole("button", { name: /filtres/i }).click();
    await page.waitForTimeout(300);
  });

  test("keyboard navigation (j/k/Enter)", async ({ page }) => {
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });

    await page.keyboard.press("j");
    await page.waitForTimeout(300);
    await page.keyboard.press("j");
    await page.waitForTimeout(300);
    await page.keyboard.press("k");
    await page.waitForTimeout(300);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/veille\/article\//, { timeout: 5000 });
  });

  test("slash key focuses search", async ({ page }) => {
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });
    await page.keyboard.press("/");
    await expect(page.getByPlaceholder(/rechercher/i)).toBeFocused();
  });

  test("date section headers are visible", async ({ page }) => {
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });
    // Date headers use uppercase font-mono — just check we have some text content above articles
    const dateHeaders = page.locator("text=/AUJOURD|HIER|LUNDI|MARDI|MERCREDI|JEUDI|VENDREDI|SAMEDI|DIMANCHE|JANVIER|FÉVRIER|MARS|AVRIL|MAI|JUIN|JUILLET|AOÛT|SEPTEMBRE|OCTOBRE|NOVEMBRE|DÉCEMBRE/i");
    await expect(dateHeaders.first()).toBeVisible();
  });
});
