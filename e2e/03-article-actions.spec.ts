import { test, expect } from "@playwright/test";
import { ensureLoggedIn, deleteTestUser, registerTestUserDirect } from "./helpers";

test.describe.serial("Article interactions (logged in)", () => {
  test.beforeAll(async () => {
    await registerTestUserDirect();
  });

  test.afterAll(async () => {
    await deleteTestUser();
  });

  test("like and unlike an article", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });

    const likeBtn = page.locator('button[aria-label="Liker"]').first();
    await expect(likeBtn).toBeVisible({ timeout: 5000 });
    await likeBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('button[aria-label="Retirer le like"]').first()).toBeVisible();

    await page.locator('button[aria-label="Retirer le like"]').first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('button[aria-label="Liker"]').first()).toBeVisible();
  });

  test("bookmark and unbookmark an article", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });

    const bookmarkBtn = page.locator('button[aria-label="Bookmarker"]').first();
    await expect(bookmarkBtn).toBeVisible({ timeout: 5000 });
    await bookmarkBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator('button[aria-label="Retirer le bookmark"]').first()).toBeVisible();

    await page.locator('button[aria-label="Retirer le bookmark"]').first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('button[aria-label="Bookmarker"]').first()).toBeVisible();
  });

  test("open article detail page", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });

    await page.locator("[data-article-id]").first().click();
    await page.waitForURL(/\/veille\/article\//, { timeout: 5000 });
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 5000 });
  });
});
