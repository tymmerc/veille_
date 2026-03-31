import { test, expect } from "@playwright/test";
import { TEST_USER, registerTestUserDirect, deleteTestUser } from "./helpers";

test.describe.serial("Auth flow", () => {
  test.beforeAll(async () => {
    await deleteTestUser();
    await registerTestUserDirect();
  });

  test.afterAll(async () => {
    await deleteTestUser();
  });

  test("login page loads with tabs", async ({ page }) => {
    await page.goto("/veille/login");
    await expect(page).toHaveTitle(/veille/i);
    await expect(page.getByText("connexion")).toBeVisible();
    await expect(page.getByText("inscription")).toBeVisible();
  });

  test("Discord OAuth button is visible", async ({ page }) => {
    await page.goto("/veille/login");
    await expect(page.getByText(/continuer avec discord/i)).toBeVisible();
  });

  test("guest can browse feed", async ({ page }) => {
    await page.goto("/veille/feed");
    await expect(page.locator("[data-article-id]").first()).toBeVisible({ timeout: 15000 });
  });

  test("login with valid credentials", async ({ page }) => {
    await page.goto("/veille/login");
    await page.getByText("connexion").first().click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email);
    await page.locator('input[type="password"]').first().fill(TEST_USER.password);
    await page.getByText("se connecter").click();
    await page.waitForURL(/\/veille\/(feed|config)/, { timeout: 15000 });
  });

  test("wrong password shows error", async ({ page }) => {
    await page.goto("/veille/login");
    await page.getByText("connexion").first().click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder(/email/i).fill(TEST_USER.email);
    await page.locator('input[type="password"]').first().fill("wrongpassword");
    await page.getByText("se connecter").click();
    await expect(page.getByText(/incorrect/i)).toBeVisible({ timeout: 5000 });
  });

  test("registration form works", async ({ page }) => {
    await page.goto("/veille/login");
    await page.getByText("inscription").click();
    await page.waitForTimeout(300);
    // Verify form fields are present
    await expect(page.getByPlaceholder(/utilisateur/i)).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    const pwFields = page.locator('input[type="password"]');
    expect(await pwFields.count()).toBeGreaterThanOrEqual(2);
    await expect(page.getByText("creer un compte")).toBeVisible();
  });
});
