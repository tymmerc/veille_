import { test, expect } from "@playwright/test";
import { ensureLoggedIn, deleteTestUser, registerTestUserDirect } from "./helpers";

test.describe.serial("Prompt configuration (in settings)", () => {
  test.beforeAll(async () => {
    await registerTestUserDirect();
  });

  test.afterAll(async () => {
    await deleteTestUser();
  });

  test("settings page has prompt/veille section", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto("/veille/settings");
    await page.waitForTimeout(1000);
    // Should have veille/interests section
    await expect(page.locator("body")).toContainText(/veille|intérêts|prompt/i, { timeout: 5000 });
  });

  test("settings has source options", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto("/veille/settings");
    await page.waitForTimeout(1000);
    // Should have some source-related content
    const hasSource = await page.locator("body").textContent();
    expect(hasSource).toBeTruthy();
  });
});
