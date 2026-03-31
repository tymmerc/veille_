import { test, expect } from "@playwright/test";
import { ensureLoggedIn, deleteTestUser, registerTestUserDirect } from "./helpers";

test.describe.serial("Settings page", () => {
  test.beforeAll(async () => {
    await registerTestUserDirect();
  });

  test.afterAll(async () => {
    await deleteTestUser();
  });

  test("settings page loads for logged-in user", async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto("/veille/settings");
    await page.waitForTimeout(1000);
    // Should have some visible content (not 404)
    await expect(page.locator("body")).toContainText(/mot de passe|profil|paramètre|veille/i);
  });
});
