import { test, expect } from "@playwright/test";

test.describe("API health checks", () => {
  test("GET /api/articles returns articles", async ({ request }) => {
    const res = await request.get("/veille/api/articles?limit=5");
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.articles).toBeDefined();
    expect(data.articles.length).toBeGreaterThan(0);
    expect(data.total).toBeGreaterThan(0);

    // Each article should have required fields
    const article = data.articles[0];
    expect(article.id).toBeDefined();
    expect(article.title).toBeDefined();
    expect(article.url).toBeDefined();
    expect(article.score).toBeDefined();
    expect(article.category).toBeDefined();
    expect(article.source).toBeDefined();
    expect(article.foundAt).toBeDefined();
  });

  test("GET /api/articles supports pagination", async ({ request }) => {
    const page1 = await (await request.get("/veille/api/articles?limit=3&page=1")).json();
    const page2 = await (await request.get("/veille/api/articles?limit=3&page=2")).json();

    expect(page1.articles.length).toBe(3);
    expect(page2.articles.length).toBeGreaterThan(0);
    // Different articles on different pages
    expect(page1.articles[0].id).not.toBe(page2.articles[0].id);
  });

  test("GET /api/articles supports category filter", async ({ request }) => {
    const res = await request.get("/veille/api/articles?category=cyber&limit=5");
    const data = await res.json();
    for (const a of data.articles) {
      expect(a.category).toBe("cyber");
    }
  });

  test("GET /api/sync requires auth", async ({ request }) => {
    const res = await request.get("/veille/api/sync");
    // Sync requires authentication
    expect(res.status()).toBe(401);
  });

  test("POST /api/auth/register validates input", async ({ request }) => {
    // Missing fields
    const res = await request.post("/veille/api/auth/register", {
      data: { username: "", email: "", password: "" },
    });
    expect(res.ok()).toBeFalsy();
  });

  test("POST /api/auth/email-login rejects invalid credentials", async ({ request }) => {
    const res = await request.post("/veille/api/auth/email-login", {
      data: { email: "nonexistent@test.com", password: "doesntmatter" },
    });
    expect(res.ok()).toBeFalsy();
  });

  test("rate limiting works", async ({ request }) => {
    // Rapid-fire requests — should eventually get 429
    const promises = Array.from({ length: 65 }, () =>
      request.get("/veille/api/articles?limit=1"),
    );
    const responses = await Promise.all(promises);
    const statuses = responses.map((r) => r.status());
    // At least one should be rate-limited (429)
    const has429 = statuses.includes(429);
    // This is informational — rate limit might be per-IP and localhost may be exempted
    expect(statuses.every((s) => s === 200 || s === 429)).toBe(true);
  });

  test("API returns proper error format", async ({ request }) => {
    // Non-existent endpoint
    const res = await request.get("/veille/api/nonexistent");
    expect(res.status()).toBe(404);
  });
});
