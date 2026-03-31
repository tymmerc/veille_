import { test, expect } from "@playwright/test";

test.describe("Feed tabs and features", () => {
  test("feed tabs exist for guest users", async ({ page }) => {
    await page.goto("/veille/feed");
    await page.waitForTimeout(1000);

    // Guest should see at least Pour toi and Explorer tabs
    const body = await page.textContent("body");
    expect(body).toContain("Explorer");
  });

  test("Explorer tab is clickable", async ({ page }) => {
    await page.goto("/veille/feed");
    await page.waitForTimeout(500);

    const explorerTab = page.getByText("Explorer", { exact: false }).first();
    await expect(explorerTab).toBeVisible({ timeout: 3000 });
    await explorerTab.click();
    await page.waitForTimeout(500);

    // Page should still have content (no crash)
    const body = await page.textContent("body");
    expect(body?.length).toBeGreaterThan(100);
  });

  test("article cards have score badges", async ({ page }) => {
    await page.goto("/veille/feed");
    await page.waitForTimeout(1000);

    // Score badges should be visible (SVG circles with scores)
    const scoreBadges = page.locator("svg circle, .score-glow-pulse, .score-glow-subtle");
    const count = await scoreBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test("search bar is accessible with / shortcut", async ({ page }) => {
    await page.goto("/veille/feed");
    await page.waitForTimeout(500);

    // Press / to focus search
    await page.keyboard.press("/");
    await page.waitForTimeout(200);

    // Search input should be focused
    const searchInput = page.getByPlaceholder(/rechercher/i);
    await expect(searchInput).toBeFocused();
  });
});
